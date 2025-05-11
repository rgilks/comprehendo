import {
  ExerciseRequestParamsSchema,
  type GenerateExerciseResult,
  type ExerciseRequestParams,
  type ExerciseContent,
  PartialQuizDataSchema,
} from '@/lib/domain/schemas';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from '@/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '@/lib/domain/ai';
import { type Result, type ActionError, success, failure } from '@/lib/utils/result-types';

export const DEFAULT_EMPTY_QUIZ_DATA = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  language: null,
  topic: null,
};

export const createErrorResponse = (error: string, details?: unknown): GenerateExerciseResult => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error: `${error}${details ? `: ${JSON.stringify(details)}` : ''}`,
  cached: false,
});

export const validateRequestParams = (requestParams: unknown) =>
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

export const tryGenerateAndCacheExercise = async (
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

export const tryGetCachedExercise = async (
  params: ExerciseRequestParams,
  userId: number | null
): Promise<GenerateExerciseResult | null> => {
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
    const cachedResult = await tryCache();
    if (cachedResult) return cachedResult;
    return createErrorResponse(generationResult.error.error);
  }
  const cachedResult = await tryCache();
  if (cachedResult) return cachedResult;
  const generationResult = await tryGenerate();
  if (generationResult.success) return createSuccessResult(generationResult.data, false);
  return createErrorResponse(generationResult.error.error);
};
