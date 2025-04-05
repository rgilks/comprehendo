import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

const apiResponseSchema = z.object({
  result: z.string(),
});

export interface ChatRequestParams {
  prompt: string;
  seed?: number;
  passageLanguage: string;
  questionLanguage: string;
  forceCache?: boolean;
}

export const CHAT_MUTATION_KEY = 'chat';

export const useChatMutation = () => {
  return useMutation({
    mutationKey: [CHAT_MUTATION_KEY],
    mutationFn: async (params: ChatRequestParams) => {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        // Define a simple type for the expected error structure
        type ErrorResponse = { error?: string; message?: string };
        let errorData: ErrorResponse = {};
        try {
          // Try to parse the error response body
          errorData = (await response.json()) as ErrorResponse;
        } catch (parseError) {
          console.warn('Could not parse error response JSON:', parseError);
          // If parsing fails, use the status text or a default message
          throw new Error(response.statusText || `HTTP error! status: ${response.status}`);
        }
        // Use the parsed error message if available
        throw new Error(
          errorData.error || errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      // Await the JSON response first, then parse
      const jsonResponse = (await response.json()) as unknown;
      const data = apiResponseSchema.parse(jsonResponse);
      return data.result;
    },
    retry: 1,
    onError: (error) => {
      console.error('Chat mutation error:', error);
    },
  });
};
