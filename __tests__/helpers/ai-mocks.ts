export interface MockAIResponseData {
  paragraph: string;
  question: string;
  options: Record<string, string>;
  explanations: Record<string, string>;
  correctAnswer: string;
  relevantText: string;
  topic: string;
}

export const defaultTestResponse: MockAIResponseData = {
  paragraph: 'This is a test paragraph.',
  question: 'What is this?',
  options: {
    A: 'A test',
    B: 'An example',
    C: 'A demo',
    D: 'A sample',
  },
  explanations: {
    A: 'Correct',
    B: 'Incorrect',
    C: 'Incorrect',
    D: 'Incorrect',
  },
  correctAnswer: 'A',
  relevantText: 'This is a test paragraph.',
  topic: 'Test Topic',
};

export const createMockOpenAIClient = (responseData: MockAIResponseData = defaultTestResponse) => {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify(responseData),
              },
            },
          ],
        }),
      },
    },
  };
};

export const createMockGoogleAIClient = (
  responseData: MockAIResponseData = defaultTestResponse
) => {
  return {
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue(JSON.stringify(responseData)),
        },
      }),
    }),
  };
};

export const createMockModelConfig = (provider: 'openai' | 'google' = 'openai') => {
  const openaiConfig = {
    id: 'gpt-3.5-turbo',
    name: 'gpt-3.5-turbo',
    provider: 'openai',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 4096,
  };

  const googleConfig = {
    id: 'gemini-2.0-flash-lite',
    name: 'gemini-2.0-flash-lite',
    provider: 'google',
    displayName: 'Gemini Flash Lite',
    maxTokens: 2048,
  };

  return provider === 'openai' ? openaiConfig : googleConfig;
};

export const setupAIMocks = (
  responseData: MockAIResponseData = defaultTestResponse,
  provider: 'openai' | 'google' = 'openai'
) => {
  const openaiClient = createMockOpenAIClient(responseData);
  const googleaiClient = createMockGoogleAIClient(responseData);

  return {
    modelConfig: createMockModelConfig(provider),
    getOpenAIClient: jest.fn().mockReturnValue(openaiClient),
    getGoogleAIClient: jest.fn().mockReturnValue(googleaiClient),
    openaiClient,
    googleaiClient,
  };
};
