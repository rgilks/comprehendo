/**
 * Request and response helpers for tests
 */
import { NextRequest, MockNextResponse } from '../mocks/next-mocks';

/**
 * Interface for test prompt request options
 */
export interface TestPromptOptions {
  prompt?: string;
  seed?: number;
  ip?: string;
  headers?: Record<string, string>;
}

/**
 * Standard prompt for tests
 */
export const defaultPrompt =
  'Generate a reading comprehension paragraph in English with multiple choice questions in English for CEFR level B1 (Intermediate) language learners.';

/**
 * Create a chat API request for testing
 */
export const createChatRequest = (options: TestPromptOptions = {}) => {
  const { prompt = defaultPrompt, seed = 42, ip = '127.0.0.1', headers = {} } = options;

  const requestHeaders = {
    'x-forwarded-for': ip,
    'Content-Type': 'application/json',
    ...headers,
  };

  return new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify({
      prompt,
      seed,
    }),
  });
};

/**
 * Check a response for success
 */
export const expectSuccessResponse = async (response: Response) => {
  // Log response status for debugging
  console.log(`Response status: ${response.status}`);

  const jsonData = await response.json().catch((e: Error) => {
    console.error('Error parsing response JSON:', e);
    return { error: 'Failed to parse JSON' };
  });
  console.log('Response data:', jsonData);

  expect(response.status).toBe(200);
  expect(jsonData.result).toBeDefined();

  return jsonData;
};

/**
 * Check a response for error
 */
export const expectErrorResponse = async (response: Response, expectedStatus: number) => {
  // Log response status for debugging
  console.log(`Response status: ${response.status}`);

  const jsonData = await response.json().catch((e: Error) => {
    console.error('Error parsing response JSON:', e);
    return { error: 'Failed to parse JSON' };
  });
  console.log('Response data:', jsonData);

  expect(response.status).toBe(expectedStatus);
  expect(jsonData.error).toBeDefined();

  return jsonData;
};
