import {
  createErrorResponse,
  tryGenerateAndCacheExercise,
  tryGetCachedExercise,
} from './exercise-helpers';
import {
  ExerciseRequestParamsSchema,
  type GenerateExerciseResult,
  type ExerciseRequestParams,
  type ExerciseContent,
  PartialQuizDataSchema,
} from '@/lib/domain/schemas';
import type { ExerciseGenerationParams } from '@/lib/domain/ai';

const CACHE_GENERATION_THRESHOLD = 100;

export const validateRequestParams = (requestParams: unknown) =>
  ExerciseRequestParamsSchema.safeParse(requestParams);

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

export const getOrGenerateExercise = async (
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
    console.warn(`[API] Generation failed (low cache): ${generationResult.error.error}`);
    const cachedResult = await tryCache();
    if (cachedResult) {
      console.log('[API] Cache fallback successful.');
      return cachedResult;
    }
    return createErrorResponse(generationResult.error.error);
  } else {
    const cachedResult = await tryCache();
    if (cachedResult) return cachedResult;
    console.warn('[API] Cache lookup failed (high cache count), attempting generation.');
    const generationResult = await tryGenerate();
    if (generationResult.success) return createSuccessResult(generationResult.data, false);
    return createErrorResponse(generationResult.error.error);
  }
};
