import { tryGenerateAndCacheExercise, tryGetCachedExercise } from './exercise-helpers';
import {
  ExerciseRequestParamsSchema,
  type GenerateExerciseResult,
  type ExerciseRequestParams,
} from '@/lib/domain/schemas';

const CACHE_GENERATION_THRESHOLD = 100;

export const validateRequestParams = (requestParams: unknown) =>
  ExerciseRequestParamsSchema.safeParse(requestParams);

const shouldReturn = (result: GenerateExerciseResult) =>
  result.quizId !== -1 ||
  result.error === 'Failed to save generated exercise to cache.' ||
  result.error === 'Failed to validate AI response structure.';

export const getOrGenerateExercise = async (
  validParams: ExerciseRequestParams,
  userId: number | null,
  cachedCount: number
): Promise<GenerateExerciseResult> => {
  const tryCache = async () => await tryGetCachedExercise(validParams, userId);
  const tryGen = async () => await tryGenerateAndCacheExercise(validParams, userId);

  if (cachedCount < CACHE_GENERATION_THRESHOLD) {
    const generationResult = await tryGen();
    if (shouldReturn(generationResult)) return generationResult;
    console.warn('[API] Generation failed (low cache), attempting cache fallback.');
    const cachedResult = await tryCache();
    if (cachedResult) return cachedResult;
    return generationResult;
  } else {
    const cachedResult = await tryCache();
    if (cachedResult) return cachedResult;
    console.warn('[API] Cache count high, but cache lookup failed. Attempting generation.');
    const generationResult = await tryGen();
    if (shouldReturn(generationResult)) return generationResult;
    return generationResult;
  }
};
