'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { LANGUAGES } from '@/lib/domain/language';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import {
  GenerateExerciseResultSchema,
  type GenerateExerciseResult,
  type PartialQuizData,
  ExerciseRequestParamsSchema,
  type ExerciseRequestParams,
  ExerciseContentSchema,
} from '@/lib/domain/schemas';
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
  language: null,
  topic: null,
};

// --- Helper Functions ---

const createErrorResponse = (error: string): GenerateExerciseResult => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error,
  cached: false,
});

const tryGenerateAndCacheExercise = async (
  params: ExerciseRequestParams,
  userId: number | null
): Promise<GenerateExerciseResult> => {
  try {
    const topicResult = getRandomTopicForLevel(params.cefrLevel);
    const topic = typeof topicResult === 'string' ? topicResult : null;
    const topicForAI = typeof topicResult === 'string' ? topicResult : 'General';
    const grammarGuidance: string = getGrammarGuidance(params.cefrLevel);
    const vocabularyGuidance: string = getVocabularyGuidance(params.cefrLevel);
    const passageLangName: string = LANGUAGES[params.passageLanguage];
    const questionLangName: string = LANGUAGES[params.questionLanguage];

    const aiData = await generateAndValidateExercise({
      topic: topicForAI,
      passageLanguage: params.passageLanguage,
      questionLanguage: params.questionLanguage,
      passageLangName,
      questionLangName,
      level: params.cefrLevel,
      grammarGuidance,
      vocabularyGuidance,
    });

    const exerciseContentParseResult = ExerciseContentSchema.safeParse(aiData);

    if (!exerciseContentParseResult.success) {
      console.error(
        '[API] AI response failed validation:',
        exerciseContentParseResult.error.errors,
        'Original Data:',
        aiData
      );
      return createErrorResponse('Failed to validate AI response structure.');
    }

    const validatedExerciseContent = exerciseContentParseResult.data;

    validatedExerciseContent.topic = topic;

    const partialQuizData: PartialQuizData = {
      paragraph: validatedExerciseContent.paragraph,
      question: validatedExerciseContent.question,
      options: validatedExerciseContent.options,
      topic: validatedExerciseContent.topic ?? null,
      language: params.passageLanguage,
    };

    let quizId: number | undefined;
    try {
      quizId = saveExerciseToCache(
        params.passageLanguage,
        params.questionLanguage,
        params.cefrLevel,
        JSON.stringify(validatedExerciseContent),
        userId
      );
      if (quizId === undefined) {
        throw new Error('Cache save returned undefined ID');
      }
    } catch (error: unknown) {
      console.error('[API:tryGenerate] Failed to save exercise to cache:', error);
      return createErrorResponse('Failed to save generated exercise to cache.');
    }

    return {
      quizData: partialQuizData,
      quizId,
      error: null,
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

export const tryGetCachedExercise = async (
  params: ExerciseRequestParams,
  userId: number | null
): Promise<GenerateExerciseResult | null> => {
  const validatedCacheResult = getValidatedExerciseFromCache(
    params.passageLanguage,
    params.questionLanguage,
    params.cefrLevel,
    userId
  );

  if (validatedCacheResult) {
    const parsedResult = GenerateExerciseResultSchema.safeParse({
      ...validatedCacheResult,
      cached: true,
    });
    if (parsedResult.success) {
      return parsedResult.data;
    } else {
      console.error(
        '[API] Cached data failed validation:',
        parsedResult.error.errors,
        'Original Data:',
        validatedCacheResult
      );
      return null;
    }
  }
  return null;
};

// --- Main Action ---

export const generateExerciseResponse = async (
  requestParams: unknown
): Promise<GenerateExerciseResult> => {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);

  const validationResult = ExerciseRequestParamsSchema.safeParse(requestParams);

  if (!validationResult.success) {
    const errorMsg = `Invalid request parameters: ${validationResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')}`;
    console.error(`[API] ${errorMsg}`, validationResult.error);
    return createErrorResponse(errorMsg);
  }

  const validParams = validationResult.data;

  const isAllowed = checkRateLimit(ip);
  if (!isAllowed) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}. Attempting cache fallback.`);
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      return cachedResult;
    }
    console.error(
      `[API] Rate limited and no suitable cache found for lang=${validParams.passageLanguage}, level=${validParams.cefrLevel}, user=${userId ?? 'anonymous'}.`
    );
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }

  const cachedCount = countCachedExercises(
    validParams.passageLanguage,
    validParams.questionLanguage,
    validParams.cefrLevel
  );

  if (cachedCount < CACHE_GENERATION_THRESHOLD) {
    const generationResult = await tryGenerateAndCacheExercise(validParams, userId);

    if (
      generationResult.quizId !== -1 ||
      generationResult.error === 'Failed to save generated exercise to cache.' ||
      generationResult.error === 'Failed to validate AI response structure.'
    ) {
      return generationResult;
    }

    console.warn('[API] Generation failed (low cache), attempting cache fallback.');
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      return cachedResult;
    }
    console.error(
      '[API] Generation failed (low cache) and cache fallback failed.',
      generationResult.error
    );
    return generationResult;
  } else {
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      return cachedResult;
    }

    console.warn('[API] Cache count high, but cache lookup failed. Attempting generation.');
    const generationResult = await tryGenerateAndCacheExercise(validParams, userId);

    if (
      generationResult.quizId !== -1 ||
      generationResult.error === 'Failed to save generated exercise to cache.' ||
      generationResult.error === 'Failed to validate AI response structure.'
    ) {
      return generationResult;
    }

    console.error(
      '[API] High cache count, cache lookup failed, and generation fallback failed.',
      generationResult.error
    );
    return generationResult;
  }
};
