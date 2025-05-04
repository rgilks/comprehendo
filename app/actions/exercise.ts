'use server';

import { getServerSession, type Session } from 'next-auth';
import { headers } from 'next/headers';
import { authOptions } from '@/lib/authOptions';
import { checkRateLimit } from '@/lib/rate-limiter';
import { getDbUserIdFromSession } from '../../lib/authUtils';
import { createErrorResponse } from '@/lib/utils/exercise-response';
import { tryGenerateAndCacheExercise, tryGetCachedExercise } from './exercise-helpers';
import { ExerciseRequestParamsSchema, type GenerateExerciseResult } from '@/lib/domain/schemas';
import { countCachedExercises } from '@/lib/exercise-cache';
import { z } from 'zod';

const CACHE_GENERATION_THRESHOLD = 100;

// --- Main Action ---

const validateRequestParams = (requestParams: unknown) => {
  return ExerciseRequestParamsSchema.safeParse(requestParams);
};

const handleRateLimit = (ip: string) => {
  return checkRateLimit(ip);
};

const getOrGenerateExercise = async (
  validParams: z.infer<typeof ExerciseRequestParamsSchema>,
  userId: number | null,
  cachedCount: number
): Promise<GenerateExerciseResult> => {
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

export const generateExerciseResponse = async (
  requestParams: unknown
): Promise<GenerateExerciseResult> => {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session: Session | null = await getServerSession(authOptions);
  const userId = getDbUserIdFromSession(session);

  const validationResult = validateRequestParams(requestParams);
  if (!validationResult.success) {
    const errorMsg = `Invalid request parameters: ${validationResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')}`;
    return createErrorResponse(errorMsg);
  }
  const validParams = validationResult.data;
  const isAllowed = handleRateLimit(ip);
  if (!isAllowed) {
    const cachedResult = await tryGetCachedExercise(validParams, userId);
    if (cachedResult) {
      return cachedResult;
    }
    return createErrorResponse('Rate limit exceeded and no cached question available.');
  }
  const cachedCount = countCachedExercises(
    validParams.passageLanguage,
    validParams.questionLanguage,
    validParams.cefrLevel
  );
  return getOrGenerateExercise(validParams, userId, cachedCount);
};
