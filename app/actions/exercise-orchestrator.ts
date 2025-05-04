import { tryGenerateAndCacheExercise, tryGetCachedExercise } from './exercise-helpers';
import { ExerciseRequestParamsSchema, type GenerateExerciseResult } from '@/lib/domain/schemas';
import { z } from 'zod';

const CACHE_GENERATION_THRESHOLD = 100;

export const validateRequestParams = (requestParams: unknown) =>
  ExerciseRequestParamsSchema.safeParse(requestParams);

export const getOrGenerateExercise = async (
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
