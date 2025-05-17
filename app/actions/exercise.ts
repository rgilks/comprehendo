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
import { type InitialExercisePairResult } from '@/lib/domain/schemas';
import { LANGUAGES } from '@/lib/domain/language';
import { checkRateLimit } from '@/lib/rate-limiter';
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

  if (!(await checkRateLimit(ip))) {
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

  if (!validParams) {
    const detailedErrorMsg = errorMsg || 'Invalid request parameters for initial pair.';
    console.warn(`[generateInitialExercisePair] Validation Error: ${detailedErrorMsg}`);
    const errorResult = createErrorResponse(detailedErrorMsg);
    return { quizzes: [errorResult, errorResult], error: detailedErrorMsg };
  }

  if (!(await checkRateLimit(ip))) {
    console.warn(`[generateInitialExercisePair] Rate limit exceeded for IP: ${ip}`);
    const errorResult = createErrorResponse('Rate limit exceeded.');
    return { quizzes: [errorResult, errorResult], error: 'Rate limit exceeded.' };
  }

  const genParams1 = buildGenParams(validParams);
  const genParams2 = buildGenParams(validParams, getRandomTopicForLevel(validParams.cefrLevel));

  try {
    const settledResults = await Promise.allSettled([
      getExerciseWithCacheFallback(genParams1, userId, 0),
      getExerciseWithCacheFallback(genParams2, userId, 0),
    ]);

    const finalQuizzes = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const reason = result.reason;
        const individualErrorMsg =
          reason instanceof Error ? reason.message : 'Unknown error generating individual exercise';
        console.error(
          `[generateInitialExercisePair] Error for exercise ${index + 1}:`,
          individualErrorMsg,
          reason
        );
        return createErrorResponse(
          `Exercise ${index + 1} generation failed: ${individualErrorMsg}`
        );
      }
    });

    const quizzesTuple: [GenerateExerciseResult, GenerateExerciseResult] = [
      finalQuizzes[0],
      finalQuizzes[1],
    ];

    const anyIndividualErrors = quizzesTuple.some((q) => q.error || q.quizId === -1);
    const overallError = anyIndividualErrors
      ? 'One or more exercises could not be generated. Please check individual quiz details.'
      : null;

    return {
      quizzes: quizzesTuple,
      error: overallError,
    };
  } catch (error) {
    console.error('[generateInitialExercisePair] Critical unexpected error:', error);
    const criticalErrorMsg =
      error instanceof Error ? error.message : 'Unknown critical server error';
    const errorResult = createErrorResponse(`Critical server error: ${criticalErrorMsg}`);
    return { quizzes: [errorResult, errorResult], error: `Server error: ${criticalErrorMsg}` };
  }
};
