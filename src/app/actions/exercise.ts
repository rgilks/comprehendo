'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/authOptions';
import { getDbUserIdFromSession } from '@/lib/authUtils';
import {
  ExerciseRequestParamsSchema,
  type GenerateExerciseResult,
  type ExerciseRequestParams,
  type ExerciseContent,
  PartialQuizDataSchema,
  type InitialExercisePairResult,
  GenerateExerciseResultSchema,
} from '@/domain/schemas';
import {
  saveExerciseToCache,
  getValidatedExerciseFromCache,
  countCachedExercises,
} from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from '@/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '@/domain/ai';
import { type Result, type ActionError, success, failure } from '@/lib/utils/result-types';
import { getRandomTopicForLevel } from '@/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from '@/domain/language-guidance';
import { LANGUAGES } from '@/domain/language';
import {
  getRateLimit,
  incrementRateLimit,
  resetRateLimit,
  createRateLimit,
} from '@/repo/rateLimitRepo';
import { z } from 'zod';
import { extractZodErrors } from '@/lib/utils/errorUtils';

const MAX_REQUESTS_PER_HOUR = parseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS_PER_HOUR'] || '100',
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

const DEFAULT_EMPTY_QUIZ_DATA = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  language: null,
  topic: null,
};

const createErrorResponse = (error: string, details?: unknown): GenerateExerciseResult => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error: `${error}${details ? `: ${JSON.stringify(details)}` : ''}`,
  cached: false,
});

const validateRequestParams = (requestParams: unknown) =>
  ExerciseRequestParamsSchema.safeParse(requestParams);

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
  language: string,
  userId: number | null
): Promise<Result<{ content: ExerciseContent; id: number }, ActionError>> => {
  try {
    const options: ExerciseGenerationOptions = { ...params, language };
    const generatedExercise = await generateAndValidateExercise(options);
    const exerciseId = saveExerciseToCache(
      params.passageLanguage,
      params.questionLanguage,
      params.level,
      JSON.stringify(generatedExercise),
      userId
    );
    if (exerciseId === undefined) {
      return failure({ error: 'Exercise generated but failed to save to cache (undefined ID).' });
    }
    return success({ content: generatedExercise, id: exerciseId });
  } catch (error) {
    return failure({
      error: `Error during AI generation/processing: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
};

const tryGetCachedExercise = (
  params: ExerciseRequestParams,
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
      quizData: validatedCacheResult.quizData,
      quizId: validatedCacheResult.quizId,
      cached: true,
      error: null,
    };
  }
  return null;
};

const getOrGenerateExercise = async (
  genParams: ExerciseGenerationParams,
  userId: number | null,
  cachedCount: number
): Promise<GenerateExerciseResult> => {
  const requestParams: ExerciseRequestParams = {
    passageLanguage: genParams.passageLanguage,
    questionLanguage: genParams.questionLanguage,
    cefrLevel: genParams.level,
  };

  const attemptGeneration = () =>
    tryGenerateAndCacheExercise(genParams, genParams.passageLanguage, userId);
  const attemptCache = () => tryGetCachedExercise(requestParams, userId);

  const preferGenerate = cachedCount < CACHE_GENERATION_THRESHOLD;
  let generationError: ActionError | null = null;

  if (preferGenerate) {
    const genResult = await attemptGeneration();
    if (genResult.success) {
      return createSuccessResult(genResult.data, false);
    }
    generationError = genResult.error;

    const cachedResult = attemptCache();
    if (cachedResult) {
      return cachedResult;
    }
    return createErrorResponse(
      generationError.error || 'Generation preferred but failed, and no cached version available.'
    );
  }

  const cachedResult = attemptCache();
  if (cachedResult) {
    return cachedResult;
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
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);
  return { ip, userId };
};

const validateAndExtractParams = (requestParams: unknown) => {
  const validationResult = validateRequestParams(requestParams);
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
  passageLanguage: validParams.passageLanguage,
  questionLanguage: validParams.questionLanguage,
  level: validParams.cefrLevel,
  passageLangName: LANGUAGES[validParams.passageLanguage],
  questionLangName: LANGUAGES[validParams.questionLanguage],
  topic: topic || getRandomTopicForLevel(validParams.cefrLevel),
  grammarGuidance: getGrammarGuidance(validParams.cefrLevel),
  vocabularyGuidance: getVocabularyGuidance(validParams.cefrLevel),
});

export const generateExerciseResponse = async (
  requestParams: unknown
): Promise<GenerateExerciseResult> => {
  const { ip, userId } = await getRequestContext();
  const { validParams, errorMsg } = validateAndExtractParams(requestParams);
  if (!validParams) return createErrorResponse(errorMsg);

  if (!checkRateLimit(ip)) {
    const cachedResult = tryGetCachedExercise(validParams, userId);
    if (cachedResult) return cachedResult;
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }

  const genParams = buildGenParams(validParams);
  const cachedCountValue = countCachedExercises(
    genParams.passageLanguage,
    genParams.questionLanguage,
    genParams.level
  );

  try {
    return await getOrGenerateExercise(genParams, userId, cachedCountValue);
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
