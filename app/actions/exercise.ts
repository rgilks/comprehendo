'use server';

import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from 'app/lib/authOptions';
import { findUserIdByProvider } from 'app/repo/userRepo';
import {
  ExerciseRequestParamsSchema,
  type GenerateExerciseResult,
  type ExerciseRequestParams,
  type ExerciseContent,
  PartialQuizDataSchema,
  type InitialExercisePairResult,
  GenerateExerciseResultSchema,
  QuizDataSchema,
  type PartialQuizData,
} from 'app/domain/schemas';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from 'app/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from 'app/domain/ai';
import { type Result, type ActionError, success, failure } from 'app/lib/utils/result-types';
import { getRandomTopicForLevel } from 'app/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from 'app/domain/language-guidance';
import { LANGUAGES, type Language } from 'app/domain/language';
import type { CEFRLevel } from 'app/domain/language-guidance';
import {
  getRateLimit,
  incrementRateLimit,
  resetRateLimit,
  createRateLimit,
} from 'app/repo/rateLimitRepo';
import {
  getCachedExerciseToAttempt as getCachedExercise,
  saveExercise as saveExerciseToCache,
  countCachedExercisesInRepo as countCachedExercises,
  type QuizRow,
} from 'app/repo/quizRepo';
import { incrementTodayUsage } from 'app/repo/aiApiUsageRepo';
import { z } from 'zod';
import { extractZodErrors } from 'app/lib/utils/errorUtils';

const getDbUserIdFromSession = (
  session: { user: { id?: string | null; provider?: string | null } } | null
): number | null => {
  if (!session || !session.user.id || !session.user.provider) {
    if (session) {
      console.warn(
        `[getDbUserIdFromSession] Cannot perform direct lookup: Missing session.user.id (${session.user.id}) or session.user.provider (${session.user.provider})`
      );
    }
    return null;
  }

  try {
    const userId = findUserIdByProvider(session.user.id, session.user.provider);
    if (userId === undefined) {
      console.warn(
        `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
      );
      return null;
    }
    return userId;
  } catch (dbError) {
    console.error('[getDbUserIdFromSession] Direct lookup DB error:', dbError);
    return null;
  }
};

const getValidatedExerciseFromCache = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null,
  excludeQuizId?: number | null
): { quizData: PartialQuizData; quizId: number } | undefined => {
  const cachedExercise: QuizRow | undefined = getCachedExercise(
    passageLanguage,
    questionLanguage,
    level,
    userId,
    excludeQuizId
  );

  if (cachedExercise) {
    try {
      const parsedCachedContent: unknown = JSON.parse(cachedExercise.content);
      const validatedCachedData = QuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error(
          '[Action:getValidated] Invalid data found in cache for ID',
          cachedExercise.id,
          ':',
          validatedCachedData.error
        );
        return undefined;
      } else {
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
        '[Action:getValidated] Error processing cached exercise ID',
        cachedExercise.id,
        ':',
        error
      );
      return undefined;
    }
  }

  return undefined;
};

const MAX_REQUESTS_PER_HOUR = parseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS_PER_HOUR'] ||
    (process.env.NODE_ENV === 'development' ? '1000' : '100'),
  10
);
const RATE_LIMIT_WINDOW = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '3600000', 10);

const checkRateLimit = (ip: string): boolean => {
  try {
    const now = Date.now();
    const rateLimitRow = getRateLimit(ip);

    if (!rateLimitRow) {
      createRateLimit(ip, new Date(now).toISOString());
      return true;
    }

    const windowStartTime = new Date(rateLimitRow.window_start_time).getTime();
    const isWithinWindow = now - windowStartTime < RATE_LIMIT_WINDOW;

    if (isWithinWindow) {
      if (rateLimitRow.request_count >= MAX_REQUESTS_PER_HOUR) {
        return false;
      }
      incrementRateLimit(ip);
      return true;
    }

    resetRateLimit(ip, new Date(now).toISOString());
    return true;
  } catch (error) {
    console.error('[RateLimiter] Error checking rate limit:', error);
    return false;
  }
};

const DEFAULT_ERROR_PARTIAL_QUIZ_DATA: PartialQuizData = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  topic: '',
};

const createErrorResponse = (error: string, details?: unknown): GenerateExerciseResult => ({
  quizData: DEFAULT_ERROR_PARTIAL_QUIZ_DATA,
  quizId: -1,
  error: `${error}${details ? `: ${JSON.stringify(details)}` : ''}`,
  cached: false,
});

const CACHE_GENERATION_THRESHOLD = 100;

const createSuccessResult = (
  data: { content: ExerciseContent; id: number },
  cached: boolean = false
): GenerateExerciseResult => {
  const partialData = PartialQuizDataSchema.parse({
    paragraph: data.content.paragraph,
    question: data.content.question,
    options: data.content.options,
    topic: data.content.topic,
  });
  return {
    quizData: partialData,
    quizId: data.id,
    error: null,
    cached,
  };
};

const tryGenerateAndCacheExercise = async (
  params: ExerciseGenerationParams,
  userId: number | null
): Promise<Result<{ content: ExerciseContent; id: number }, ActionError>> => {
  try {
    // Check daily AI API budget before making expensive API calls
    if (!incrementTodayUsage()) {
      return failure({
        error: 'Daily AI API request limit exceeded. Please try again tomorrow.',
      });
    }

    console.log('[Exercise] Starting generation for:', {
      passageLanguage: params.passageLanguage,
      questionLanguage: params.questionLanguage,
      level: params.level,
      userId,
    });

    const options: ExerciseGenerationOptions = { ...params, language: params.passageLanguage };
    const generatedExercise = await generateAndValidateExercise(options);

    console.log('[Exercise] AI generation successful, attempting to save to cache...');

    const exerciseId = saveExerciseToCache(
      params.passageLanguage,
      params.questionLanguage,
      params.level,
      JSON.stringify(generatedExercise),
      userId
    );

    if (typeof exerciseId !== 'number') {
      console.error('[Exercise] Failed to save to cache - exerciseId is not a number:', exerciseId);
      return failure({
        error: `Exercise generated but failed to save to cache (undefined ID). Generated exercise: ${JSON.stringify(generatedExercise).substring(0, 100)}...`,
      });
    }

    console.log('[Exercise] Successfully saved exercise with ID:', exerciseId);
    return success({ content: generatedExercise, id: exerciseId });
  } catch (error) {
    console.error('[Exercise] Error during generation:', error);
    return failure({
      error: `Error during AI generation/processing: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};

const getOrGenerateExercise = async (
  genParams: ExerciseGenerationParams,
  userId: number | null,
  cachedCount: number,
  excludeQuizId?: number | null
): Promise<GenerateExerciseResult> => {
  const requestParams: ExerciseRequestParams = {
    passageLanguage: genParams.passageLanguage,
    questionLanguage: genParams.questionLanguage,
    cefrLevel: genParams.level,
    excludeQuizId,
  };

  const attemptGeneration = () => tryGenerateAndCacheExercise(genParams, userId);

  const preferGenerate = cachedCount < CACHE_GENERATION_THRESHOLD;
  let generationError: ActionError | null = null;

  if (preferGenerate) {
    const genResult = await attemptGeneration();
    if (genResult.success) {
      return createSuccessResult(genResult.data, false);
    }
    generationError = genResult.error;

    const validatedCacheResultPreferGen = getValidatedExerciseFromCache(
      requestParams.passageLanguage,
      requestParams.questionLanguage,
      requestParams.cefrLevel,
      userId,
      excludeQuizId
    );
    if (validatedCacheResultPreferGen) {
      return {
        quizData: validatedCacheResultPreferGen.quizData,
        quizId: validatedCacheResultPreferGen.quizId,
        cached: true,
        error: null,
      };
    }
    return createErrorResponse(
      generationError.error || 'Generation preferred but failed, and no cached version available.'
    );
  }

  const validatedCacheResultOtherwise = getValidatedExerciseFromCache(
    requestParams.passageLanguage,
    requestParams.questionLanguage,
    requestParams.cefrLevel,
    userId,
    excludeQuizId
  );
  if (validatedCacheResultOtherwise) {
    return {
      quizData: validatedCacheResultOtherwise.quizData,
      quizId: validatedCacheResultOtherwise.quizId,
      cached: true,
      error: null,
    };
  }

  const genResult = await attemptGeneration();
  if (genResult.success) {
    return createSuccessResult(genResult.data, false);
  }
  return createErrorResponse(
    genResult.error.error || 'Cache miss and subsequent generation failed.'
  );
};

const getRequestContext = async () => {
  const headersList = await headers();
  const ip = headersList.get('fly-client-ip') || headersList.get('x-forwarded-for') || 'unknown';
  const session = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);
  return { ip, userId };
};

const validateAndExtractParams = (requestParams: unknown) => {
  const validationResult = ExerciseRequestParamsSchema.safeParse(requestParams);
  if (!validationResult.success) {
    return {
      validParams: null,
      errorMsg: `Invalid request parameters: ${extractZodErrors(validationResult.error)}`,
    };
  }
  return { validParams: validationResult.data, errorMsg: null };
};

const buildGenParams = (
  validParams: ExerciseRequestParams,
  topic?: string
): ExerciseGenerationParams => ({
  passageLanguage: validParams.passageLanguage as Language,
  questionLanguage: validParams.questionLanguage as Language,
  level: validParams.cefrLevel as CEFRLevel,
  passageLangName: LANGUAGES[validParams.passageLanguage as Language],
  questionLangName: LANGUAGES[validParams.questionLanguage as Language],
  topic: topic || getRandomTopicForLevel(validParams.cefrLevel as CEFRLevel),
  grammarGuidance: getGrammarGuidance(validParams.cefrLevel as CEFRLevel),
  vocabularyGuidance: getVocabularyGuidance(validParams.cefrLevel as CEFRLevel),
});

export const generateExerciseResponse = async (
  requestParams: unknown
): Promise<GenerateExerciseResult> => {
  const { ip, userId } = await getRequestContext();
  const { validParams, errorMsg } = validateAndExtractParams(requestParams);
  if (!validParams) return createErrorResponse(errorMsg);

  const excludeQuizId = validParams.excludeQuizId ?? null;

  if (!checkRateLimit(ip)) {
    // Try to find cached questions for the exact parameters first
    const validatedCacheResultRateLimit = getValidatedExerciseFromCache(
      validParams.passageLanguage,
      validParams.questionLanguage,
      validParams.cefrLevel,
      userId,
      excludeQuizId
    );
    if (validatedCacheResultRateLimit) {
      return {
        quizData: validatedCacheResultRateLimit.quizData,
        quizId: validatedCacheResultRateLimit.quizId,
        cached: true,
        error: null,
      };
    }

    // If no exact match, try to find any cached questions for this language
    const fallbackCacheResult = getValidatedExerciseFromCache(
      validParams.passageLanguage,
      validParams.questionLanguage,
      'A1', // Try with A1 level as fallback
      userId,
      excludeQuizId
    );
    if (fallbackCacheResult) {
      return {
        quizData: fallbackCacheResult.quizData,
        quizId: fallbackCacheResult.quizId,
        cached: true,
        error: null,
      };
    }

    return createErrorResponse(
      'Rate limit exceeded. Please wait a moment and try again, or try a different language/level combination.'
    );
  }

  const genParams = buildGenParams(validParams);
  const cachedCountValue = countCachedExercises(
    genParams.passageLanguage,
    genParams.questionLanguage,
    genParams.level
  );

  try {
    return await getOrGenerateExercise(genParams, userId, cachedCountValue, excludeQuizId);
  } catch (error) {
    console.error('Error in generateExerciseResponse:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error during exercise generation process'
    );
  }
};

export const generateInitialExercisePair = async (
  requestParams: unknown
): Promise<InitialExercisePairResult> => {
  const { ip, userId } = await getRequestContext();
  const { validParams, errorMsg } = validateAndExtractParams(requestParams);
  if (!validParams) return { quizzes: [], error: errorMsg };

  if (!checkRateLimit(ip)) return { quizzes: [], error: 'Rate limit exceeded.' };

  const genParams1 = buildGenParams(validParams);
  const genParams2 = buildGenParams(validParams, getRandomTopicForLevel(validParams.cefrLevel));

  try {
    const [res1, res2] = await Promise.all([
      getOrGenerateExercise(genParams1, userId, 0),
      getOrGenerateExercise(genParams2, userId, 0),
    ]);

    const errors = [res1, res2].map((r) => r.error).filter(Boolean);
    if (errors.length > 0) {
      return { quizzes: [], error: `Failed to generate exercise pair: ${errors.join('; ')}` };
    }

    const validatedResults = z.array(GenerateExerciseResultSchema).safeParse([res1, res2]);
    if (validatedResults.success) {
      return {
        quizzes: validatedResults.data as [GenerateExerciseResult, GenerateExerciseResult],
        error: null,
      };
    }
    return {
      quizzes: [],
      error: 'Internal error processing generated results after successful generation.',
    };
  } catch (error) {
    console.error('Error in generateInitialExercisePair:', error);
    const message = error instanceof Error ? error.message : 'Unknown generation error';
    return { quizzes: [], error: `Server error during generation: ${message}` };
  }
};
