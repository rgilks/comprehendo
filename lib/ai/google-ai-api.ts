import { GoogleGenAI } from '@google/genai';
import { getGoogleAIClient } from '@/lib/ai/client';

// Export the error class related to AI processing/API calls
export class AIResponseProcessingError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

export const callGoogleAI = async (prompt: string): Promise<string> => {
  const genAI: GoogleGenAI = getGoogleAIClient();

  const generationConfig = {
    maxOutputTokens: 500, // Consider making this configurable if needed
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

    // Assuming getGoogleAIClient returns a valid GenAI instance or throws
    const result = await genAI.models.generateContent(request);

    // Directly access the text property from the result object.
    const text: string | undefined = result.text;

    if (text === undefined) {
      console.error(
        '[AI API] Failed to extract text from Google AI response:',
        JSON.stringify(result, null, 2) // Log the full result for debugging
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
        console.warn('[AI API] Response received, but no JSON block found:', text);
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
      // If it's already our custom error, rethrow it directly potentially
      if (error instanceof AIResponseProcessingError) {
        throw error;
      }
      console.error('[AI API] Google AI API call failed:', error.message, error.stack);
      errorMessage = error.message;
    } else {
      console.error('[AI API] Google AI API call failed with non-Error object:', error);
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
