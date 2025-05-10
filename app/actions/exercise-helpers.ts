import {
  type ExerciseContent,
  type PartialQuizData,
  type GenerateExerciseResult,
} from '@/lib/domain/schemas';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from '@/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '@/lib/domain/ai';
import { type Result, type ActionError, success, failure } from '@/lib/utils/result-types';
import type { ExerciseRequestParams } from '@/lib/domain/schemas';

export const DEFAULT_EMPTY_QUIZ_DATA: PartialQuizData = {
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
      console.error(
        '[API:tryGenerate] Failed to save exercise to cache: Cache save returned undefined ID'
      );
      return failure<{ content: ExerciseContent; id: number }, ActionError>({
        error: 'Exercise generated but failed to save to cache (undefined ID).',
      });
    }
    console.log(`[API:tryGenerate] Generated and cached exercise ID: ${exerciseId}`);
    return success<{ content: ExerciseContent; id: number }, ActionError>({
      content: generatedExercise,
      id: exerciseId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[API:tryGenerate] Error:', errorMessage);
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
  } else {
    return null;
  }
};
