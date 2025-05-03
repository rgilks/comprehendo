'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { getActiveModel } from '@/lib/modelConfig';
import { LANGUAGES, type Language } from '@/config/languages';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import {
  QuizDataSchema,
  GenerateExerciseResult,
  type PartialQuizData,
  QuizData,
} from '@/lib/domain/schemas';
import { authOptions } from '@/lib/authOptions';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  getCachedExercise,
  saveExerciseToCache,
  countCachedExercises,
  type QuizRow,
} from '@/lib/exercise-cache';
import {
  generateExercisePrompt,
  callGoogleAI,
  AIResponseProcessingError,
} from '@/lib/ai/exercise-generator';

const _exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof _exerciseRequestBodySchema>;

// Helper function for AI generation and validation
const _generateAndValidateExercise = async ({
  topic,
  passageLanguage,
  questionLanguage,
  passageLangName,
  questionLangName,
  level,
  grammarGuidance,
  vocabularyGuidance,
}: {
  topic: string;
  passageLanguage: Language;
  questionLanguage: Language;
  passageLangName: string;
  questionLangName: string;
  level: CEFRLevel;
  grammarGuidance: string;
  vocabularyGuidance: string;
}): Promise<QuizData> => {
  const activeModel = getActiveModel();

  const prompt = generateExercisePrompt({
    topic,
    passageLanguage,
    questionLanguage,
    passageLangName,
    questionLangName,
    level,
    grammarGuidance,
    vocabularyGuidance,
  });

  const cleanedAiResponseContent = await callGoogleAI(prompt, activeModel);

  let parsedAiContent: unknown;
  try {
    parsedAiContent = JSON.parse(cleanedAiResponseContent);
  } catch (parseError: unknown) {
    console.error(
      '[API:_generateAndValidateExercise] Failed to parse AI response JSON:',
      parseError,
      '\nCleaned Response:\n',
      cleanedAiResponseContent
    );
    const errorToCapture = parseError instanceof Error ? parseError : new Error(String(parseError));
    throw new AIResponseProcessingError(
      `Failed to parse AI JSON response. Error: ${errorToCapture.message}`,
      errorToCapture // Pass original error
    );
  }

  const validationResult = QuizDataSchema.safeParse(parsedAiContent);
  if (!validationResult.success) {
    console.error(
      '[API:_generateAndValidateExercise] AI response failed Zod validation:',
      JSON.stringify(validationResult.error.format(), null, 2)
    );
    console.error(
      '[API:_generateAndValidateExercise] Failing AI Response Content:',
      cleanedAiResponseContent
    );
    throw new AIResponseProcessingError(
      `AI response failed validation. Errors: ${JSON.stringify(validationResult.error.format())}`
    );
  }
  // We return the full data here, the caller will decide what to save/return
  return validationResult.data;
};

// Helper function to get DB user ID from session
const _getDbUserIdFromSession = (session: Session | null): number | null => {
  if (session?.user.id && session.user.provider) {
    try {
      const userRecord = db
        .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
        .get(session.user.id, session.user.provider);
      if (
        userRecord &&
        typeof userRecord === 'object' &&
        'id' in userRecord &&
        typeof userRecord.id === 'number'
      ) {
        return userRecord.id;
      } else {
        console.warn(
          `[API:_getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
        );
        return null;
      }
    } catch (dbError) {
      console.error('[API:_getDbUserIdFromSession] Direct lookup DB error:', dbError);
      return null; // Return null on DB error
    }
  } else {
    console.warn(
      `[API:_getDbUserIdFromSession] Cannot perform direct lookup: Missing session.user.id (${session?.user.id}) or session.user.provider (${session?.user.provider})`
    );
    return null;
  }
};

// Helper function to get and validate a cached exercise
const _getValidatedCachedExercise = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): { quizData: PartialQuizData; quizId: number } | undefined => {
  const cachedExercise: QuizRow | undefined = getCachedExercise(
    passageLanguage,
    questionLanguage,
    level,
    userId
  );

  if (cachedExercise) {
    try {
      const parsedCachedContent: unknown = JSON.parse(cachedExercise.content);
      const validatedCachedData = QuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error(
          '[API:_getValidatedCachedExercise] Invalid data found in cache for ID',
          cachedExercise.id,
          ':',
          validatedCachedData.error.format()
        );
        // If cache data is invalid, treat it as a cache miss
        return undefined;
      } else {
        // Type is inferred correctly after successful validation
        const fullData = validatedCachedData.data;
        const partialData: PartialQuizData = {
          paragraph: fullData.paragraph,
          question: fullData.question,
          options: fullData.options,
          topic: fullData.topic,
        };
        return {
          quizData: partialData,
          quizId: cachedExercise.id,
        };
      }
    } catch (error) {
      console.error(
        '[API:_getValidatedCachedExercise] Error processing cached exercise ID',
        cachedExercise.id,
        ':',
        error
      );
      // If processing fails, treat it as a cache miss
      return undefined;
    }
  }

  // No cached exercise found
  return undefined;
};

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
  const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!validCefrLevels.includes(levelStr as CEFRLevel)) {
    console.error(`[API] Invalid CEFR level received: ${levelStr}`);
    return {
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
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
  const CACHE_GENERATION_THRESHOLD = 100;
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
      const validatedAiData = await _generateAndValidateExercise({
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
      const finalUserId = _getDbUserIdFromSession(session);
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
        quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } }, // Default object
        quizId: -1, // Placeholder ID
        cached: false,
      };
    }
  }

  // --- Fallback Path: Use Cached Exercise ---
  const userIdForCacheLookup = session?.user.dbId || _getDbUserIdFromSession(session); // Try dbId first, then lookup
  const validatedCacheResult = _getValidatedCachedExercise(
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
    quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
    quizId: -1,
    error: 'Could not retrieve or generate a question.',
  };
};
