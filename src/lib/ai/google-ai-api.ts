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

export const callGoogleAI = async (prompt: string): Promise<unknown> => {
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

    // Clean up markdown fences (```json ... ```) and attempt to parse
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    let potentialJsonString: string;

    if (match && match[1]) {
      potentialJsonString = match[1].trim();
    } else {
      // If no fences, assume the whole text might be JSON
      const trimmedText = text.trim();
      // Basic check if it looks like a JSON object or array
      if (
        (trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
        (trimmedText.startsWith('[') && trimmedText.endsWith(']'))
      ) {
        potentialJsonString = trimmedText;
      } else {
        // If it doesn't look like JSON and wasn't in fences, log and throw.
        console.warn(
          '[AI API] Response received, but no JSON block found or text is not valid JSON:',
          text
        );
        throw new AIResponseProcessingError(
          'AI response received, but failed to extract valid JSON content.'
        );
      }
    }

    try {
      // Let JSON.parse handle invalid JSON. Caller should validate structure.
      const parsedJson = JSON.parse(potentialJsonString);
      return parsedJson;
    } catch (parseError) {
      console.error(
        '[AI API] Failed to parse JSON from AI response string:',
        potentialJsonString,
        'Error:',
        parseError
      );
      throw new AIResponseProcessingError('Failed to parse JSON from AI response.', parseError);
    }
  } catch (error: unknown) {
    let errorMessage = 'Unknown AI generation error';
    let originalErrorForRethrow = error;

    if (error instanceof Error) {
      errorMessage = error.message;
      // Keep the most specific error instance if it's already ours
      if (error instanceof AIResponseProcessingError) {
        originalErrorForRethrow = error.originalError ?? error; // Prefer original error if available
      }
    } else {
      console.error('[AI API] Google AI API call failed with non-Error object:', error);
    }

    // Check for specific error messages like safety settings
    if (typeof errorMessage === 'string' && errorMessage.includes('SAFETY')) {
      console.warn(`[AI API] Safety setting blocked response: ${errorMessage}`);
      throw new AIResponseProcessingError(
        `Safety setting blocked response: ${errorMessage}`,
        originalErrorForRethrow
      );
    }

    // General error wrapping
    console.error(
      `[AI API] AI generation failed. Message: ${errorMessage}`,
      originalErrorForRethrow
    );
    throw new AIResponseProcessingError(
      `AI generation failed: ${errorMessage}`,
      originalErrorForRethrow
    );
  }
};
