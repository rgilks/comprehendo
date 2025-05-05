import {
  type ExerciseContent,
  type PartialQuizData,
  type GenerateExerciseResult,
} from '@/lib/domain/schemas';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  AIResponseProcessingError,
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
  let generatedExercise: ExerciseContent | null = null;
  let generationError: ActionError | null = null;

  try {
    const options: ExerciseGenerationOptions = { ...params, language };
    generatedExercise = await generateAndValidateExercise(options);
  } catch (error) {
    let errorMessage = 'Unknown error during AI generation/processing';
    let stack = '';
    let originalErrorDetail: unknown = null;

    if (error instanceof AIResponseProcessingError) {
      errorMessage = `Error during AI generation/processing: ${error.message}`;
      if (error.originalError instanceof Error) {
        console.error(
          '[API] Original AI Error:',
          error.originalError.message,
          error.originalError.stack
        );
        stack = error.originalError.stack ?? '';
      } else if (error.originalError !== null) {
        console.error('[API] Original AI Error (non-Error object):', error.originalError);
        originalErrorDetail = error.originalError;
      } else {
        stack = error.stack ?? '';
      }
    } else if (error instanceof Error) {
      errorMessage = `Error during AI generation/processing: ${error.message}`;
      stack = error.stack ?? '';
    } else {
      errorMessage = `Error during AI generation/processing (non-Error object): ${String(error)}`;
      console.error(errorMessage);
      originalErrorDetail = error;
    }

    console.error(`[API] ${errorMessage}`, stack ? `\nStack: ${stack}` : '');

    generationError = {
      error: errorMessage,
      details: originalErrorDetail,
      ...(stack && { stack }),
    };
  }

  if (generatedExercise) {
    try {
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
    } catch (cacheError) {
      console.error('[API:tryGenerate] Failed to save exercise to cache:', cacheError);
      return failure<{ content: ExerciseContent; id: number }, ActionError>({
        error: 'Exercise generated but failed to save to cache. Please try again.',
        details: cacheError,
      });
    }
  } else {
    return failure<{ content: ExerciseContent; id: number }, ActionError>(
      generationError ?? { error: 'Unknown generation failure.' }
    );
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
