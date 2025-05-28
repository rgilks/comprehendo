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
} from '@/lib/domain/schemas';
import {
  saveExerciseToCache,
  getValidatedExerciseFromCache,
  countCachedExercises,
} from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from '@/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '@/lib/domain/ai';
import { type Result, type ActionError, success, failure } from '@/lib/utils/result-types';
import { getRandomTopicForLevel } from '@/lib/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import { LANGUAGES } from '@/lib/domain/language';
import { checkRateLimit } from '@/app/actions/rate-limiter';
import { z } from 'zod';
import { extractZodErrors } from '@/lib/utils/errorUtils';

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
      return failure<{ content: ExerciseContent; id: number }, ActionError>({
        error: 'Exercise generated but failed to save to cache (undefined ID).',
      });
    }
    return success<{ content: ExerciseContent; id: number }, ActionError>({
      content: generatedExercise,
      id: exerciseId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return failure<{ content: ExerciseContent; id: number }, ActionError>({
      error: `Error during AI generation/processing: ${errorMessage}`,
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
  const tryGenerate = () =>
    tryGenerateAndCacheExercise(genParams, genParams.passageLanguage, userId);
  const tryCache = () => tryGetCachedExercise(requestParams, userId);
  const preferGenerate = cachedCount < CACHE_GENERATION_THRESHOLD;

  if (preferGenerate) {
    const generationResult = await tryGenerate();
    if (generationResult.success) return createSuccessResult(generationResult.data, false);
    const cachedResult = tryCache();
    if (cachedResult) return cachedResult;
    return createErrorResponse(generationResult.error.error);
  }

  const cachedResult = tryCache();
  if (cachedResult) return cachedResult;
  const generationResult = await tryGenerate();
  if (generationResult.success) return createSuccessResult(generationResult.data, false);
  return createErrorResponse(generationResult.error.error);
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

const getExerciseWithCacheFallback = async (
  genParams: ExerciseGenerationParams,
  userId: number | null,
  cachedCount: number
): Promise<GenerateExerciseResult> => {
  const result = await getOrGenerateExercise(genParams, userId, cachedCount);
  if (result.quizId === -1 && result.error == null) {
    throw new Error('Internal Error: Failed to generate or retrieve exercise.');
  }
  return result;
};

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
    return await getExerciseWithCacheFallback(genParams, userId, cachedCountValue);
  } catch (error) {
    console.error('Error in generateExerciseResponse:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error during exercise generation process';
    return createErrorResponse(errorMessage);
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
      getExerciseWithCacheFallback(genParams1, userId, 0),
      getExerciseWithCacheFallback(genParams2, userId, 0),
    ]);
    if ([res1, res2].every((r) => r.error === null && r.quizId !== -1)) {
      const validatedResults = z.array(GenerateExerciseResultSchema).safeParse([res1, res2]);
      if (validatedResults.success) {
        return {
          quizzes: validatedResults.data as [GenerateExerciseResult, GenerateExerciseResult],
          error: null,
        };
      }
      return { quizzes: [], error: 'Internal error processing generated results.' };
    }
    const errors = [res1, res2].map((r) => r.error).filter((e) => e !== null);
    return { quizzes: [], error: `Failed to generate exercise pair: ${errors.join('; ')}` };
  } catch (error) {
    console.error('Error in generateInitialExercisePair:', error);
    const message = error instanceof Error ? error.message : 'Unknown generation error';
    return { quizzes: [], error: `Server error during generation: ${message}` };
  }
};
