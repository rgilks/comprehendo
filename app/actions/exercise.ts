'use server';

import { z } from 'zod';
import { getServerSession } from 'next-auth';
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

const _exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof _exerciseRequestBodySchema>;

export const generateExerciseResponse = async (
  params: ExerciseRequestParams
): Promise<GenerateExerciseResult> => {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session = await getServerSession(authOptions);

  const { passageLanguage, questionLanguage, cefrLevel: level } = params;

  const passageLanguageStr = String(passageLanguage);
  const questionLanguageStr = String(questionLanguage);
  const levelStr = String(level);

  // --- Parameter Validation ---
  if (!(passageLanguageStr in LANGUAGES)) {
    console.error(`[API] Invalid passage language received: ${passageLanguageStr}`);
    return {
      quizData: DEFAULT_EMPTY_QUIZ_DATA,
      quizId: -1,
      error: `Invalid passage language: ${passageLanguageStr}`,
    };
  }

  if (!(questionLanguageStr in LANGUAGES)) {
    console.error(`[API] Invalid question language received: ${questionLanguageStr}`);
    return {
      quizData: DEFAULT_EMPTY_QUIZ_DATA,
      quizId: -1,
      error: `Invalid question language: ${questionLanguageStr}`,
    };
  }

  const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!validCefrLevels.includes(levelStr as CEFRLevel)) {
    console.error(`[API] Invalid CEFR level received: ${levelStr}`);
    return {
      quizData: DEFAULT_EMPTY_QUIZ_DATA,
      quizId: -1,
      error: `Invalid CEFR level: ${levelStr}`,
    };
  }
  const cefrLevelTyped = levelStr as CEFRLevel;

  // --- Rate Limit Check ---
  const isAllowed = checkRateLimit(ip);

  if (!isAllowed) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}`);
    // If rate limited, immediately try to fall back to cache
  }

  // --- Cache Count Check ---
  const cachedCount = countCachedExercises(passageLanguage, questionLanguage, level);

  // --- Primary Path: Generate New Exercise ---

  if (isAllowed && cachedCount < CACHE_GENERATION_THRESHOLD) {
    try {
      const topicResult = getRandomTopicForLevel(cefrLevelTyped);
      const topic = typeof topicResult === 'string' ? topicResult : String(topicResult);
      const grammarGuidance: string = getGrammarGuidance(cefrLevelTyped);
      const vocabularyGuidance: string = getVocabularyGuidance(cefrLevelTyped);
      const passageLangName: string = LANGUAGES[passageLanguageStr as Language];
      const questionLangName: string = LANGUAGES[questionLanguageStr as Language];

      // Generate the exercise using the helper function
      const validatedAiData = await generateAndValidateExercise({
        topic,
        passageLanguage: passageLanguageStr as Language,
        questionLanguage: questionLanguageStr as Language,
        passageLangName,
        questionLangName,
        level: cefrLevelTyped,
        grammarGuidance,
        vocabularyGuidance,
      });

      // Prepare the content to be saved (original cleaned string)
      // Note: We need the string form to save to cache. We re-parse if we fetch from cache.
      // This assumes _generateAndValidateExercise successfully parsed it, so JSON.stringify should work.
      const contentToCache = JSON.stringify(validatedAiData);

      // --- Direct User ID Lookup before saving ---
      const finalUserId = getDbUserIdFromSession(session);
      // --- End Direct User ID Lookup ---

      const quizId = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        contentToCache, // Save the stringified validated data
        finalUserId // Use the directly looked-up ID
      );

      if (quizId === undefined) {
        console.error('[API] Failed to save generated exercise to cache.');
        // Proceed without cache ID, but log error
        const partialData: PartialQuizData = {
          paragraph: validatedAiData.paragraph,
          question: validatedAiData.question,
          options: validatedAiData.options,
          topic: validatedAiData.topic,
        };
        return {
          quizData: partialData,
          quizId: -1, // Indicate error or non-cache state
          error: 'Failed to save exercise to cache.',
          cached: false,
        };
      }

      const partialData: PartialQuizData = {
        paragraph: validatedAiData.paragraph,
        question: validatedAiData.question,
        options: validatedAiData.options,
        topic: validatedAiData.topic,
      };

      return {
        quizData: partialData,
        quizId: quizId,
        cached: false, // Mark as newly generated
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

        // Specific handling for AIResponseProcessingError
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

      // Determine final error message
      const finalErrorMessage =
        error instanceof AIResponseProcessingError
          ? errorMessage // Use the message from AIResponseProcessingError
          : `An unexpected error occurred during exercise generation: ${errorMessage}`;

      // Return error conforming to expected structure
      return {
        error: finalErrorMessage,
        quizData: DEFAULT_EMPTY_QUIZ_DATA,
        quizId: -1,
        cached: false,
      };
    }
  }

  // --- Fallback Path: Use Cached Exercise ---
  const userIdForCacheLookup = session?.user.dbId || getDbUserIdFromSession(session);
  const validatedCacheResult = getValidatedExerciseFromCache(
    passageLanguage,
    questionLanguage,
    level,
    userIdForCacheLookup
  );

  if (validatedCacheResult) {
    return {
      ...validatedCacheResult, // Contains quizData and quizId
      cached: true,
    };
  }

  // --- Final Fallback: No Question Available ---
  console.error(
    `[API] Exhausted options: Failed to generate and no suitable cache found for lang=${passageLanguage}, level=${level}, user=${session?.user.dbId ?? 'anonymous'}.`
  );
  return {
    quizData: DEFAULT_EMPTY_QUIZ_DATA,
    quizId: -1,
    error: 'Could not retrieve or generate a question.',
  };
};
