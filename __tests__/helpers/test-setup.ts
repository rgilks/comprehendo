/**
 * Common test setup and teardown helpers
 */
import { createMockDb } from './db-mock';
import { setupAIMocks, defaultTestResponse } from './ai-mocks';

/**
 * Configure logging for tests
 * @param enableLogs Whether to enable logs during tests
 */
export const setupTestLogging = (enableLogs = true) => {
  const originalLog = console.log;
  const originalError = console.error;

  // Replace log functions with noop if logs are disabled
  if (!enableLogs) {
    console.log = jest.fn();
    console.error = jest.fn();
  } else {
    console.log = originalLog;
    console.error = originalError;
  }

  // Return a cleanup function
  return () => {
    console.log = originalLog;
    console.error = originalError;
  };
};

/**
 * Setup common environment variables for tests
 */
export const setupTestEnvironment = () => {
  const originalEnv = { ...process.env };

  // Set API keys
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.GOOGLE_AI_API_KEY = 'test-key';

  // Return a cleanup function
  return () => {
    process.env = originalEnv;
  };
};

/**
 * Setup common mocks for tests
 */
export const setupCommonMocks = () => {
  // Setup auth mock
  jest.mock('next-auth', () => ({
    getServerSession: jest.fn().mockResolvedValue(null),
  }));

  // Setup db mock
  jest.mock('../../lib/db', () => createMockDb());

  // Setup OpenAI constructors
  jest.mock('openai', () => {
    const { createMockOpenAIClient } = require('./ai-mocks');
    return {
      OpenAI: jest.fn().mockImplementation(() => createMockOpenAIClient()),
    };
  });

  // Setup modelConfig mock
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

/**
 * Setup authenticated user session
 */
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
