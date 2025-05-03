import { GoogleGenAI } from '@google/genai';
import { getGoogleAIClient } from '@/lib/ai/client';
import type { QuizData } from '@/lib/domain/schemas';
import { QuizDataSchema } from '@/lib/domain/schemas';
import {
  generateExercisePrompt,
  type ExerciseGenerationParams,
} from '@/lib/ai/prompts/exercise-prompt';

// Export the error class
export class AIResponseProcessingError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

// Helper function for AI generation and validation
export const generateAndValidateExercise = async ({
  topic,
  passageLanguage,
  questionLanguage,
  passageLangName,
  questionLangName,
  level,
  grammarGuidance,
  vocabularyGuidance,
}: ExerciseGenerationParams): Promise<QuizData> => {
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

export const callGoogleAI = async (prompt: string): Promise<string> => {
  const genAI: GoogleGenAI = getGoogleAIClient();

  const generationConfig = {
    maxOutputTokens: 500,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
    candidateCount: 1,
    responseMimeType: 'application/json',
  };

  try {
    // Use environment variable for model name, with a fallback
    const modelName = process.env['GOOGLE_AI_GENERATION_MODEL'] ?? 'gemini-2.5-flash-preview-04-17';
    if (!process.env['GOOGLE_AI_GENERATION_MODEL']) {
      console.warn(
        `[AI] GOOGLE_AI_GENERATION_MODEL environment variable not set. Using default: ${modelName}`
      );
    }

    const request = {
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: generationConfig,
    };

    const result = await genAI.models.generateContent(request);

    const text: string | undefined = result.text;

    if (text === undefined) {
      console.error(
        '[AI Generator] Failed to extract text from Google AI response:',
        JSON.stringify(result, null, 2)
      );
      throw new AIResponseProcessingError(
        'No content received from Google AI or failed to extract text.'
      );
    }

    // Clean up markdown fences (```json ... ```)
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    let potentialJson: string;

    if (match && match[1]) {
      potentialJson = match[1].trim();
    } else {
      // If no fences, assume the whole text might be JSON
      const trimmedText = text.trim();
      if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
        potentialJson = trimmedText;
      } else {
        // If it doesn't look like JSON and wasn't in fences, throw an error.
        console.warn('[AI] Response received, but no JSON block found:', text);
        throw new AIResponseProcessingError(
          'AI response received, but failed to extract JSON content block.'
        );
      }
    }
    return potentialJson;
  } catch (error: unknown) {
    // Use instanceof Error for type checking
    let errorMessage = 'Unknown AI generation error';
    if (error instanceof Error) {
      console.error('[AI] Google AI API call failed:', error.message, error.stack);
      errorMessage = error.message;
    } else {
      console.error('[AI] Google AI API call failed with non-Error object:', error);
    }

    // Check for specific error messages if possible (e.g., safety settings)
    if (errorMessage.includes('SAFETY')) {
      throw new AIResponseProcessingError(
        `Safety setting blocked response: ${errorMessage}`,
        error // Pass original error (unknown)
      );
    }
    // General error
    throw new AIResponseProcessingError(`AI generation failed: ${errorMessage}`, error); // Pass original error (unknown)
  }
};
