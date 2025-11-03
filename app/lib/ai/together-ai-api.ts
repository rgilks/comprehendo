import { getTogetherAIApiKey } from 'app/lib/ai/together-ai-client';
import { AIResponseProcessingError } from 'app/lib/ai/google-ai-api';

interface TogetherAIResponse {
  id: string;
  choices: Array<{
    finish_reason: string;
    index: number;
    message: {
      content: string;
      role: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const callTogetherAI = async (prompt: string): Promise<unknown> => {
  const apiKey = getTogetherAIApiKey();
  const modelName =
    process.env['TOGETHER_AI_MODEL'] ?? 'Qwen/Qwen2.5-7B-Instruct-Turbo';

  if (!process.env['TOGETHER_AI_MODEL']) {
    console.warn(
      `[TogetherAI] TOGETHER_AI_MODEL environment variable not set. Using default: ${modelName}`
    );
  }

  try {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TogetherAI API] API request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new AIResponseProcessingError(
        `Together AI API request failed: ${response.status} ${response.statusText}`,
        errorText
      );
    }

    const data: TogetherAIResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      console.error('[TogetherAI API] No choices in response:', JSON.stringify(data, null, 2));
      throw new AIResponseProcessingError('No content received from Together AI response.');
    }

    const text = data.choices[0]?.message?.content;

    if (!text) {
      console.error(
        '[TogetherAI API] Failed to extract content from Together AI response:',
        JSON.stringify(data, null, 2)
      );
      throw new AIResponseProcessingError(
        'No content received from Together AI or failed to extract text.'
      );
    }

    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    let potentialJsonString: string;

    if (match && match[1]) {
      potentialJsonString = match[1].trim();
    } else {
      const trimmedText = text.trim();
      if (
        (trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
        (trimmedText.startsWith('[') && trimmedText.endsWith(']'))
      ) {
        potentialJsonString = trimmedText;
      } else {
        console.warn(
          '[TogetherAI API] Response received, but no JSON block found or text is not valid JSON:',
          text
        );
        throw new AIResponseProcessingError(
          'Together AI response received, but failed to extract valid JSON content.'
        );
      }
    }

    try {
      const parsedJson = JSON.parse(potentialJsonString);
      return parsedJson;
    } catch (parseError) {
      console.error(
        '[TogetherAI API] Failed to parse JSON from Together AI response string:',
        potentialJsonString,
        'Error:',
        parseError
      );
      throw new AIResponseProcessingError(
        'Failed to parse JSON from Together AI response.',
        parseError
      );
    }
  } catch (error: unknown) {
    let errorMessage = 'Unknown Together AI generation error';
    let originalErrorForRethrow = error;

    if (error instanceof Error) {
      errorMessage = error.message;
      if (error instanceof AIResponseProcessingError) {
        originalErrorForRethrow = error.originalError ?? error;
      }
    } else {
      console.error('[TogetherAI API] Together AI API call failed with non-Error object:', error);
    }

    console.error(
      `[TogetherAI API] Together AI generation failed. Message: ${errorMessage}`,
      originalErrorForRethrow
    );
    throw new AIResponseProcessingError(
      `Together AI generation failed: ${errorMessage}`,
      originalErrorForRethrow
    );
  }
};

