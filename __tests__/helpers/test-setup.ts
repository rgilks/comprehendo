import { createMockDb } from './db-mock';
import { setupAIMocks } from './ai-mocks';

export const setupTestLogging = (enableLogs = true) => {
  const originalLog = console.log;
  const originalError = console.error;

  if (!enableLogs) {
    console.log = jest.fn();
    console.error = jest.fn();
  } else {
    console.log = originalLog;
    console.error = originalError;
  }

  return () => {
    console.log = originalLog;
    console.error = originalError;
  };
};

export const setupTestEnvironment = () => {
  const originalEnv = { ...process.env };

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.GOOGLE_AI_API_KEY = 'test-key';

  return () => {
    process.env = originalEnv;
  };
};

export const setupCommonMocks = () => {
  jest.mock('next-auth', () => ({
    getServerSession: jest.fn().mockResolvedValue(null),
  }));

  jest.mock('../../lib/db', () => createMockDb());

  jest.mock('openai', () => {
    const { createMockOpenAIClient } = require('./ai-mocks');
    return {
      OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
    };
  });

  const aiMockData = setupAIMocks();

  jest.mock('../../lib/modelConfig', () => ({
    getActiveModel: jest.fn().mockReturnValue(aiMockData.modelConfig),
    getOpenAIClient: aiMockData.getOpenAIClient,
    getGoogleAIClient: aiMockData.getGoogleAIClient,
  }));

  return {
    mockModelConfig: aiMockData.modelConfig,
    mockOpenAIClient: aiMockData.openaiClient,
    mockGoogleAIClient: aiMockData.googleaiClient,
  };
};

export const setupAuthenticatedSession = (
  user = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
  }
) => {
  require('next-auth').getServerSession.mockResolvedValue({
    user,
  });

  return user;
};
