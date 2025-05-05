import { QuizDataSchema, type QuizData } from '@/lib/domain/schemas';
import { generateExercisePrompt } from '@/lib/ai/prompts/exercise-prompt';
import { ExerciseGenerationParamsSchema, type ExerciseGenerationParams } from '@/lib/domain/ai';
import { callGoogleAI, AIResponseProcessingError } from '@/lib/ai/google-ai-api';

// Re-export the error class if needed downstream, or remove if only used internally
export { AIResponseProcessingError };

// Helper function for AI generation and validation
export const generateAndValidateExercise = async (
  params: ExerciseGenerationParams
): Promise<QuizData | null> => {
  // Validate input params using the schema
  const validatedParams = ExerciseGenerationParamsSchema.parse(params);

  // Destructure from the validated parameters
  const {
    topic,
    passageLanguage,
    questionLanguage,
    passageLangName,
    questionLangName,
    level,
    grammarGuidance,
    vocabularyGuidance,
  } = validatedParams;

  const prompt = generateExercisePrompt({
    topic,
    passageLanguage,
    questionLanguage,
    passageLangName,
    questionLangName,
    level,
    grammarGuidance,
    vocabularyGuidance,
  });

  const cleanedAiResponseContent = await callGoogleAI(prompt);

  let parsedAiContent: unknown;
  try {
    parsedAiContent = JSON.parse(cleanedAiResponseContent);
  } catch (parseError: unknown) {
    console.error(
      '[AI:generateAndValidateExercise] Failed to parse AI response JSON:',
      parseError,
      '\nCleaned Response:\n',
      cleanedAiResponseContent
    );
    const errorToCapture = parseError instanceof Error ? parseError : new Error(String(parseError));
    throw new AIResponseProcessingError(
      `Failed to parse AI JSON response. Error: ${errorToCapture.message}`,
      errorToCapture // Pass original error
    );
  }

  const validationResult = QuizDataSchema.safeParse(parsedAiContent);
  if (!validationResult.success) {
    console.error(
      '[AI:generateAndValidateExercise] AI response failed Zod validation:',
      JSON.stringify(validationResult.error.format(), null, 2)
    );
    console.error(
      '[AI:generateAndValidateExercise] Failing AI Response Content:',
      cleanedAiResponseContent
    );
    throw new AIResponseProcessingError(
      `AI response failed validation. Errors: ${JSON.stringify(validationResult.error.format())}`
    );
  }

  // Ensure topic is string or null, not undefined, after successful validation
  const validatedData = validationResult.data;
  if (validatedData.topic === undefined) {
    validatedData.topic = null;
  }

  // Assert the final type after transformation
  return validatedData;
};

export type { QuizData };
