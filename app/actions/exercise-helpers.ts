import { type PartialQuizData, type GenerateExerciseResult } from '@/lib/domain/schemas';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  AIResponseProcessingError,
  type ExerciseGenerationOptions,
} from '@/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '@/lib/domain/ai';
import { type Result, type ActionError, success, failure } from '@/lib/utils';

export const DEFAULT_EMPTY_QUIZ_DATA: PartialQuizData = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  language: null,
  topic: null,
};

export const createErrorResponse = (error: string): GenerateExerciseResult => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error,
  cached: false,
});

export const tryGenerateAndCacheExercise = async (
  params: ExerciseGenerationParams,
  language: string
): Promise<Result<ExerciseContent, ActionError>> => {
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
        // Log the original stack trace if available
        console.error(
          '[API] Original AI Error:',
          error.originalError.message,
          error.originalError.stack
        );
        stack = error.originalError.stack ?? '';
      } else if (error.originalError !== null) {
        // Log non-Error original error detail
        console.error('[API] Original AI Error (non-Error object):', error.originalError);
        originalErrorDetail = error.originalError;
      } else {
        stack = error.stack ?? '';
      }
    } else if (error instanceof Error) {
      errorMessage = `Error during AI generation/processing: ${error.message}`;
      stack = error.stack ?? '';
    } else {
      // Handle cases where a non-Error object is thrown
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

  // If generation succeeded, try to save it to the cache
  if (generatedExercise) {
    try {
      const exerciseId = await saveExerciseToCache(generatedExercise);
      if (exerciseId === undefined) {
        // Handle case where saving might not return an ID or fail silently
        console.error(
          '[API:tryGenerate] Failed to save exercise to cache: Cache save returned undefined ID'
        );
        return failure({
          error: 'Exercise generated but failed to save to cache (undefined ID).',
        });
      }
      console.log(`[API:tryGenerate] Generated and cached exercise ID: ${exerciseId}`);
      return success(generatedExercise);
    } catch (cacheError) {
      console.error('[API:tryGenerate] Failed to save exercise to cache:', cacheError);
      // Decide if we should still return the generated exercise even if caching failed
      // For now, let's return failure as caching is important
      return failure({
        error: 'Exercise generated but failed to save to cache. Please try again.',
        details: cacheError,
      });
    }
  } else {
    // Generation failed, return the captured error
    return failure(generationError ?? { error: 'Unknown generation failure.' });
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
    const parsedResult = GenerateExerciseResultSchema.safeParse({
      ...validatedCacheResult,
      cached: true,
    });
    if (parsedResult.success) {
      return parsedResult.data;
    } else {
      console.error(
        '[API] Cached data failed validation:',
        parsedResult.error.errors,
        'Original Data:',
        validatedCacheResult
      );
      return null;
    }
  }
  return null;
};
