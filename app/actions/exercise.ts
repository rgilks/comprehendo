'use server';

import { z } from 'zod';
import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { LANGUAGES, type Language } from '@/config/languages';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import { GenerateExerciseResult, type PartialQuizData } from '@/lib/domain/schemas';
import { authOptions } from '@/lib/authOptions';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  saveExerciseToCache,
  countCachedExercises,
  getValidatedExerciseFromCache,
} from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  AIResponseProcessingError,
} from '@/lib/ai/exercise-generator';
import { getDbUserIdFromSession } from '../../lib/authUtils';

const CACHE_GENERATION_THRESHOLD = 100;
const DEFAULT_EMPTY_QUIZ_DATA: PartialQuizData = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
};

// Define the expected structure of validated AI data locally
type ValidatedAiData = {
  paragraph: string;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  topic?: string | null; // Reverted: topic is now guaranteed to be string or null
  // Add other fields returned by generateAndValidateExercise if necessary
};

type ValidatedParams = {
  passageLanguage: Language;
  questionLanguage: Language;
  cefrLevel: CEFRLevel;
};

// --- Helper Functions ---

const createErrorResponse = (error: string): GenerateExerciseResult => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error,
  cached: false,
});

const validateParams = (
  params: ExerciseRequestParams
): ValidatedParams | GenerateExerciseResult => {
  const { passageLanguage, questionLanguage, cefrLevel: level } = params;

  const passageLangStr = String(passageLanguage);
  const questionLangStr = String(questionLanguage);
  const levelStr = String(level);

  if (!(passageLangStr in LANGUAGES)) {
    const errorMsg = `Invalid passage language: ${passageLangStr}`;
    console.error(`[API] ${errorMsg}`);
    return createErrorResponse(errorMsg);
  }

  if (!(questionLangStr in LANGUAGES)) {
    const errorMsg = `Invalid question language: ${questionLangStr}`;
    console.error(`[API] ${errorMsg}`);
    return createErrorResponse(errorMsg);
  }

  const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!validCefrLevels.includes(levelStr as CEFRLevel)) {
    const errorMsg = `Invalid CEFR level: ${levelStr}`;
    console.error(`[API] ${errorMsg}`);
    return createErrorResponse(errorMsg);
  }

  return {
    passageLanguage: passageLangStr as Language,
    questionLanguage: questionLangStr as Language,
    cefrLevel: levelStr as CEFRLevel,
  };
};

const tryGenerateAndCacheExercise = async (
  params: ValidatedParams,
  userId: number | null
): Promise<GenerateExerciseResult> => {
  try {
    const topicResult = getRandomTopicForLevel(params.cefrLevel);
    const topic = typeof topicResult === 'string' ? topicResult : String(topicResult);
    const grammarGuidance: string = getGrammarGuidance(params.cefrLevel);
    const vocabularyGuidance: string = getVocabularyGuidance(params.cefrLevel);
    const passageLangName: string = LANGUAGES[params.passageLanguage];
    const questionLangName: string = LANGUAGES[params.questionLanguage];

    const validatedAiData = (await generateAndValidateExercise({
      topic,
      passageLanguage: params.passageLanguage,
      questionLanguage: params.questionLanguage,
      passageLangName,
      questionLangName,
      level: params.cefrLevel,
      grammarGuidance,
      vocabularyGuidance,
    })) as ValidatedAiData;

    const contentToCache = JSON.stringify(validatedAiData);
    const quizId = saveExerciseToCache(
      params.passageLanguage,
      params.questionLanguage,
      params.cefrLevel,
      contentToCache,
      userId
    );

    const partialData: PartialQuizData = {
      paragraph: validatedAiData.paragraph,
      question: validatedAiData.question,
      options: validatedAiData.options,
      topic: validatedAiData.topic,
    };

    if (quizId === undefined) {
      console.error('[API] Failed to save generated exercise to cache.');
      return {
        quizData: partialData,
        quizId: -1,
        error: 'Failed to save exercise to cache.',
        cached: false,
      };
    }

    return {
      quizData: partialData,
      quizId: quizId,
      cached: false,
    };
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred during exercise generation';
    let originalErrorStack: string | undefined = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      originalErrorStack = error.stack;
      console.error(
        '[API] Error during AI generation/processing:',
        errorMessage,
        originalErrorStack
      );

      if (error instanceof AIResponseProcessingError && error.originalError) {
        if (error.originalError instanceof Error) {
          console.error(
            '[API] Original AI Error:',
            error.originalError.message,
            error.originalError.stack
          );
        } else {
          console.error('[API] Original AI Error (non-Error object):', error.originalError);
        }
      }
    } else {
      console.error('[API] Error during AI generation/processing (non-Error object):', error);
    }

    const finalErrorMessage =
      error instanceof AIResponseProcessingError
        ? errorMessage
        : `An unexpected error occurred during exercise generation: ${errorMessage}`;

    return createErrorResponse(finalErrorMessage);
  }
};

const tryGetCachedExercise = (
  params: ValidatedParams,
  userId: number | null
): GenerateExerciseResult | null => {
  const validatedCacheResult = getValidatedExerciseFromCache(
    params.passageLanguage,
    params.questionLanguage,
    params.cefrLevel,
    userId
  );

  if (validatedCacheResult) {
    return {
      ...validatedCacheResult,
      cached: true,
    };
  }
  return null;
};

// --- Main Action ---

const _exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof _exerciseRequestBodySchema>;

export const generateExerciseResponse = async (
  requestParams: ExerciseRequestParams
): Promise<GenerateExerciseResult> => {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session); // Get user ID once (is number | null)

  // --- Parameter Validation ---
  const validationResult = validateParams(requestParams);
  if ('error' in validationResult) {
    return validationResult; // Return error response if validation fails
  }
  // Use type assertion as compiler fails to narrow correctly
  const validParams = validationResult as ValidatedParams;

  // --- Rate Limit Check ---
  const isAllowed = checkRateLimit(ip);
  if (!isAllowed) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}. Attempting cache fallback.`);
    // Use validParams now
    const cachedResult = tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      return cachedResult;
    }
    console.error(
      `[API] Rate limited and no suitable cache found for lang=${validParams.passageLanguage}, level=${validParams.cefrLevel}, user=${userId ?? 'anonymous'}.`
    );
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }

  // --- Cache Count Check & Generation Logic ---
  const cachedCount = countCachedExercises(
    validParams.passageLanguage,
    validParams.questionLanguage,
    validParams.cefrLevel
  );

  if (cachedCount < CACHE_GENERATION_THRESHOLD) {
    // Attempt to generate a new exercise
    const generationResult = await tryGenerateAndCacheExercise(validParams, userId);

    // If generation succeeded OR if it failed ONLY during the save step,
    // return the result (which includes the generated data and specific save error).
    if (
      generationResult.quizId !== -1 ||
      generationResult.error === 'Failed to save exercise to cache.'
    ) {
      return generationResult;
    }

    // If generation failed for other reasons (AI error, validation, etc.),
    // log it (already done in tryGenerateAndCacheExercise) and proceed to check cache as a fallback.
    console.warn('[API] Generation failed, attempting cache fallback.');
  }

  // --- Fallback Path: Use Cached Exercise ---
  const cachedResult = tryGetCachedExercise(validParams, userId);
  if (cachedResult) {
    return cachedResult;
  }

  // --- Final Fallback: No Question Available ---
  console.error(
    `[API] Exhausted options: Failed to generate and no suitable cache found for lang=${validParams.passageLanguage}, level=${validParams.cefrLevel}, user=${userId ?? 'anonymous'}.`
  );
  return createErrorResponse('Could not retrieve or generate a question.');
};
