'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/authOptions';
import { getDbUserIdFromSession } from '../../lib/authUtils';
import {
  createErrorResponse,
  tryGetCachedExercise,
  validateRequestParams,
  getOrGenerateExercise,
} from './exercise-logic';
import { countCachedExercises } from '@/lib/exercise-cache';
import { getRandomTopicForLevel } from '@/lib/domain/topics';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';
import { type InitialExercisePairResult, GenerateExerciseResultSchema } from '@/lib/domain/schemas';
import { LANGUAGES } from '@/lib/domain/language';
import { checkRateLimit } from '@/lib/rate-limiter';
import { z } from 'zod';
import type { GenerateExerciseResult, ExerciseRequestParams } from '@/lib/domain/schemas';
import { extractZodErrors } from '../../lib/utils/errorUtils';

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
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) return cachedResult;
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }

  const genParams = buildGenParams(validParams);
  const cachedCount = countCachedExercises(
    genParams.passageLanguage,
    genParams.questionLanguage,
    genParams.level
  );

  try {
    return await getExerciseWithCacheFallback(genParams, userId, cachedCount);
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
