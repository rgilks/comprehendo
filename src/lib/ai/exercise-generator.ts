import { generateExercisePrompt } from '@/lib/ai/prompts/exercise-prompt';
import { ExerciseContent, ExerciseContentSchema, type QuizData } from '@/domain/schemas';
import { type ExerciseGenerationParams } from '@/domain/ai';
import { callGoogleAI, AIResponseProcessingError } from '@/lib/ai/google-ai-api';

export { AIResponseProcessingError };

export type ExerciseGenerationOptions = ExerciseGenerationParams & {
  language: string;
};

export const generateAndValidateExercise = async (
  options: ExerciseGenerationOptions
): Promise<ExerciseContent> => {
  const prompt = generateExercisePrompt(options);

  let aiResponse: unknown;
  try {
    aiResponse = await callGoogleAI(prompt);
  } catch (error) {
    console.error('[AI:generateAndValidateExercise] Google AI call failed:', error);
    if (error instanceof AIResponseProcessingError) {
      throw error;
    } else {
      throw new AIResponseProcessingError('AI generation call failed', error);
    }
  }

  if (typeof aiResponse !== 'object' || aiResponse === null) {
    console.error(
      '[AI:generateAndValidateExercise] AI response was not a valid object:',
      aiResponse
    );
    throw new AIResponseProcessingError(
      'AI response format is invalid (not an object).',
      aiResponse
    );
  }

  const parsedAiContent = aiResponse as Record<string, unknown>;

  try {
    const validationResult = ExerciseContentSchema.safeParse(parsedAiContent);

    if (!validationResult.success) {
      console.error(
        '[AI:generateAndValidateExercise] AI response failed Zod validation:',
        validationResult.error.format()
      );
      console.log(
        '[AI:generateAndValidateExercise] Failing AI Response Content:',
        JSON.stringify(parsedAiContent)
      );
      throw new AIResponseProcessingError(
        'AI response failed structure validation.',
        validationResult.error
      );
    }

    console.log('[AI:generateAndValidateExercise] AI response successfully parsed and validated.');
    return validationResult.data;
  } catch (error) {
    if (error instanceof AIResponseProcessingError) {
      throw error;
    }
    console.error('[AI:generateAndValidateExercise] Unexpected error during validation:', error);
    throw new AIResponseProcessingError('Unexpected validation error', error);
  }
};

export type { QuizData };
