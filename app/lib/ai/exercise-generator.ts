import { generateExercisePrompt } from 'app/lib/ai/prompts/exercise-prompt';
import { ExerciseContent, ExerciseContentSchema, type QuizData } from 'app/domain/schemas';
import { type ExerciseGenerationParams } from 'app/domain/ai';
import { callGoogleAI, AIResponseProcessingError } from 'app/lib/ai/google-ai-api';
import { callTogetherAI } from 'app/lib/ai/together-ai-api';
import { z } from 'zod';

export { AIResponseProcessingError };

type AIProvider = 'google' | 'together';

const getAIProvider = (): AIProvider => {
  const provider = process.env['AI_PROVIDER']?.toLowerCase();
  if (provider === 'together' || provider === 'together-ai') {
    return 'together';
  }
  return 'google';
};

export type ExerciseGenerationOptions = ExerciseGenerationParams & {
  language: string;
};

export const generateAndValidateExercise = async (
  options: ExerciseGenerationOptions,
  maxRetries: number = 2
): Promise<ExerciseContent> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const prompt = generateExercisePrompt(options);

      let aiResponse: unknown;
      const provider = getAIProvider();

      try {
        if (provider === 'together') {
          aiResponse = await callTogetherAI(prompt);
        } else {
          aiResponse = await callGoogleAI(prompt);
        }
      } catch (error) {
        console.error(`[AI:generateAndValidateExercise] ${provider === 'together' ? 'Together' : 'Google'} AI call failed:`, error);
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

      // First, validate JSON structure
      let validationResult;
      try {
        validationResult = ExerciseContentSchema.safeParse(parsedAiContent);

        if (!validationResult.success) {
          console.error(
            '[AI:generateAndValidateExercise] AI response failed Zod validation:',
            z.treeifyError(validationResult.error)
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
      } catch (error) {
        if (error instanceof AIResponseProcessingError) {
          throw error;
        }
        console.error(
          '[AI:generateAndValidateExercise] Unexpected error during validation:',
          error
        );
        throw new AIResponseProcessingError('Unexpected validation error', error);
      }

      const exerciseContent = validationResult.data;

      // Skip quality validation - trust the AI and let users give feedback
      console.log(
        `[AI:generateAndValidateExercise] Content generated successfully on attempt ${attempt + 1}`
      );
      return exerciseContent;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[AI:generateAndValidateExercise] Attempt ${attempt + 1} failed:`, lastError);

      if (attempt === maxRetries) {
        break; // Exit retry loop
      }
    }
  }

  // If we get here, all attempts failed
  throw lastError || new AIResponseProcessingError('All generation attempts failed', null);
};

export type { QuizData };
