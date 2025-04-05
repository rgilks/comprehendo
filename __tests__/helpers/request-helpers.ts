import { NextRequest } from '../mocks/next-mocks';

export interface TestPromptOptions {
  prompt?: string;
  seed?: number;
  ip?: string;
  headers?: Record<string, string>;
  passageLanguage?: string;
  questionLanguage?: string;
}

export const defaultPrompt =
  'Generate a reading comprehension paragraph in English with multiple choice questions in English for CEFR level B1 (Intermediate) language learners.';

export const createChatRequest = (options: TestPromptOptions = {}) => {
  const {
    prompt = defaultPrompt,
    seed = 42,
    ip = '127.0.0.1',
    headers = {},
    passageLanguage = 'English',
    questionLanguage = 'English',
  } = options;

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
      passageLanguage,
      questionLanguage,
    }),
  });
};

export const expectSuccessResponse = async (response: Response) => {
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

export const expectErrorResponse = async (response: Response, expectedStatus: number) => {
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
