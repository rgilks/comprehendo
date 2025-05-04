import { LANGUAGES } from '@/lib/domain/language';
import { getGrammarGuidance, getVocabularyGuidance } from '@/lib/domain/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import {
  GenerateExerciseResultSchema,
  type GenerateExerciseResult,
  type PartialQuizData,
  type ExerciseRequestParams,
  ExerciseContentSchema,
} from '@/lib/domain/schemas';
import { saveExerciseToCache, getValidatedExerciseFromCache } from '@/lib/exercise-cache';
import {
  generateAndValidateExercise,
  type QuizData,
  AIResponseProcessingError,
} from '@/lib/ai/exercise-generator';
import { createErrorResponse } from '@/lib/utils/exercise-response';

export const tryGenerateAndCacheExercise = async (
  params: ExerciseRequestParams,
  userId: number | null
): Promise<GenerateExerciseResult> => {
  try {
    const topicResult = getRandomTopicForLevel(params.cefrLevel);
    const topic = typeof topicResult === 'string' ? topicResult : null;
    const topicForAI = typeof topicResult === 'string' ? topicResult : 'General';
    const grammarGuidance: string = getGrammarGuidance(params.cefrLevel);
    const vocabularyGuidance: string = getVocabularyGuidance(params.cefrLevel);
    const passageLangName: string = LANGUAGES[params.passageLanguage];
    const questionLangName: string = LANGUAGES[params.questionLanguage];

    const aiData: QuizData | null = await generateAndValidateExercise({
      topic: topicForAI,
      passageLanguage: params.passageLanguage,
      questionLanguage: params.questionLanguage,
      passageLangName,
      questionLangName,
      level: params.cefrLevel,
      grammarGuidance,
      vocabularyGuidance,
    });

    if (aiData == null) {
      return {
        quizData: {
          paragraph: '',
          question: '',
          options: { A: '', B: '', C: '', D: '' },
          topic: null,
          language: null,
        },
        quizId: -1,
        error: 'Failed to validate AI response structure.',
        cached: false,
      };
    }

    const exerciseContentParseResult = ExerciseContentSchema.safeParse(aiData);

    if (!exerciseContentParseResult.success) {
      console.error(
        '[API] AI response failed validation:',
        exerciseContentParseResult.error.errors,
        'Original Data:',
        aiData
      );
      return createErrorResponse('Failed to validate AI response structure.');
    }

    const validatedExerciseContent = exerciseContentParseResult.data;

    validatedExerciseContent.topic = topic;

    const partialQuizData: PartialQuizData = {
      paragraph: validatedExerciseContent.paragraph,
      question: validatedExerciseContent.question,
      options: validatedExerciseContent.options,
      topic: validatedExerciseContent.topic ?? null,
      language: params.passageLanguage,
    };

    let quizId: number | undefined;
    try {
      quizId = saveExerciseToCache(
        params.passageLanguage,
        params.questionLanguage,
        params.cefrLevel,
        JSON.stringify(validatedExerciseContent),
        userId
      );
      if (quizId === undefined) {
        throw new Error('Cache save returned undefined ID');
      }
    } catch (error: unknown) {
      console.error('[API:tryGenerate] Failed to save exercise to cache:', error);
      return createErrorResponse('Failed to save generated exercise to cache.');
    }

    return {
      quizData: partialQuizData,
      quizId,
      error: null,
      cached: false,
    };
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred during exercise generation';
    let originalErrorStack: string | undefined = undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      originalErrorStack = error.stack;
      console.error(
        '[API] Error during AI generation/processing:',
        errorMessage,
        originalErrorStack
      );

      if (error instanceof AIResponseProcessingError && error.originalError) {
        if (error.originalError instanceof Error) {
          console.error(
            '[API] Original AI Error:',
            error.originalError.message,
            error.originalError.stack
          );
        } else {
          console.error('[API] Original AI Error (non-Error object):', error.originalError);
        }
      }
    } else {
      console.error('[API] Error during AI generation/processing (non-Error object):', error);
    }

    const finalErrorMessage =
      error instanceof AIResponseProcessingError
        ? errorMessage
        : `An unexpected error occurred during exercise generation: ${errorMessage}`;

    return createErrorResponse(finalErrorMessage);
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
