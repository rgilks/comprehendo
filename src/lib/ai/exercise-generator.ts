import { generateExercisePrompt } from '@/lib/ai/prompts/exercise-prompt';
import { ExerciseContent, ExerciseContentSchema, type QuizData } from '@/lib/domain/schemas';
import { type ExerciseGenerationParams } from '@/lib/domain/ai';
import { callGoogleAI, AIResponseProcessingError } from '@/lib/ai/google-ai-api';

// Re-export the error class if needed downstream, or remove if only used internally
export { AIResponseProcessingError };

export type ExerciseGenerationOptions = ExerciseGenerationParams & {
  language: string;
};

// Define the expected structure of the AI's JSON response
// This is kept internal as the function returns the validated ExerciseContent
// type AIResponseFormat = {
//   paragraph: string;
//   question: string;
//   options: { [key: string]: string };
//   correctAnswer: string;
//   explanation: string; // DEPRECATED: Use allExplanations
//   allExplanations: { [key: string]: string }; // Explanation for each option
//   relevantText: string; // Specific text from the paragraph relevant to the question
//   topic?: string | null; // Optional topic
// };

export const generateAndValidateExercise = async (
  options: ExerciseGenerationOptions
): Promise<ExerciseContent> => {
  const prompt = generateExercisePrompt(options);
  //  console.log('[AI:generateAndValidateExercise] Generated Prompt:\n', prompt);

  let aiResponse: unknown;
  try {
    aiResponse = await callGoogleAI(prompt);
  } catch (error) {
    console.error('[AI:generateAndValidateExercise] Google AI call failed:', error);
    // Re-throw specific AI processing errors or a generic one
    if (error instanceof AIResponseProcessingError) {
      throw error; // Rethrow the specific error
    } else {
      throw new AIResponseProcessingError('AI generation call failed', error);
    }
  }

  // Ensure the response is a string before attempting to parse if callGoogleAI returned a string
  // If callGoogleAI already parsed it (returning object/unknown), we need to handle that.
  // Current implementation of callGoogleAI returns Promise<unknown> which is already parsed.

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

  // Now we know it's an object, but need to cast carefully or validate.
  // For now, let's cast and let Zod handle detailed validation.
  const parsedAiContent = aiResponse as Record<string, unknown>;

  try {
    // Validate the structure of the parsed JSON using Zod
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
    return validationResult.data; // Return the validated data directly
  } catch (error) {
    // Catch potential errors during validation itself, though safeParse should handle most
    if (error instanceof AIResponseProcessingError) {
      throw error; // Re-throw if it's already our specific error
    }
    console.error('[AI:generateAndValidateExercise] Unexpected error during validation:', error);
    throw new AIResponseProcessingError('Unexpected validation error', error);
  }
};

export type { QuizData };
