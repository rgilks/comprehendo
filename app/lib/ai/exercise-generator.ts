import { generateExercisePrompt } from 'app/lib/ai/prompts/exercise-prompt';
import { ExerciseContent, ExerciseContentSchema, type QuizData } from 'app/domain/schemas';
import { type ExerciseGenerationParams } from 'app/domain/ai';
import { callGoogleAI, AIResponseProcessingError } from 'app/lib/ai/google-ai-api';
import {
  validateQuestionQuality,
  logQualityMetrics,
  debugValidationFailure,
} from 'app/lib/ai/question-validator';

export { AIResponseProcessingError };

export type ExerciseGenerationOptions = ExerciseGenerationParams & {
  language: string;
};

export const generateAndValidateExercise = async (
  options: ExerciseGenerationOptions,
  maxRetries: number = 5
): Promise<ExerciseContent> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
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

      // First, validate JSON structure
      let validationResult;
      try {
        validationResult = ExerciseContentSchema.safeParse(parsedAiContent);

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

      // Now validate question quality
      const qualityValidation = validateQuestionQuality(exerciseContent, options.level);
      logQualityMetrics(qualityValidation.metrics, options.level, options.language);

      if (qualityValidation.isValid || attempt === maxRetries) {
        if (qualityValidation.isValid) {
          console.log(
            `[AI:generateAndValidateExercise] Quality validation passed on attempt ${attempt + 1}`
          );
        } else {
          console.warn(
            `[AI:generateAndValidateExercise] Quality validation failed on final attempt ${attempt + 1}: ${qualityValidation.reason}`
          );
          // Debug the validation failure
          debugValidationFailure(exerciseContent, qualityValidation.reason);
        }
        return exerciseContent;
      } else {
        console.warn(
          `[AI:generateAndValidateExercise] Quality validation failed on attempt ${attempt + 1}: ${qualityValidation.reason}. Retrying...`
        );
        // Debug the validation failure for retry attempts
        debugValidationFailure(exerciseContent, qualityValidation.reason);
        lastError = new AIResponseProcessingError(
          `Quality validation failed: ${qualityValidation.reason}`,
          qualityValidation.metrics
        );
        // Continue to next attempt
      }
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
