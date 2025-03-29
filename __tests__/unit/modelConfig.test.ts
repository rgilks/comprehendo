import { getActiveModel, getOpenAIClient, getGoogleAIClient, MODELS } from '../../lib/modelConfig';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the external dependencies
jest.mock('openai');
jest.mock('@google/generative-ai');

describe('Model Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    delete process.env.ACTIVE_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_AI_API_KEY;
  });

  afterAll(() => {
    // Restore original environment after all tests
    process.env = originalEnv;
  });

  describe('getActiveModel', () => {
    it('should return default model when no env variable is set', () => {
      const model = getActiveModel();
      expect(model).toEqual(MODELS['gemini-2.0-flash-lite']);
    });

    it('should return the model specified in env variable if valid', () => {
      process.env.ACTIVE_MODEL = 'gpt-3.5-turbo';
      const model = getActiveModel();
      expect(model).toEqual(MODELS['gpt-3.5-turbo']);
    });

    it('should return default model when env variable is invalid', () => {
      process.env.ACTIVE_MODEL = 'invalid-model';
      const model = getActiveModel();
      expect(model).toEqual(MODELS['gemini-2.0-flash-lite']);
    });
  });

  describe('getOpenAIClient', () => {
    it('should create a new OpenAI client with the API key', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      getOpenAIClient();
      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-openai-key' });
    });
  });

  describe('getGoogleAIClient', () => {
    it('should create a new GoogleGenerativeAI client with the API key', () => {
      process.env.GOOGLE_AI_API_KEY = 'test-google-key';
      getGoogleAIClient();
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-google-key');
    });

    it('should create a GoogleGenerativeAI client with empty string if no API key', () => {
      // Ensure no API key in env
      delete process.env.GOOGLE_AI_API_KEY;

      // Mock console.warn to avoid polluting test output
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      getGoogleAIClient();
      expect(GoogleGenerativeAI).toHaveBeenCalledWith('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: GOOGLE_AI_API_KEY is not set');

      consoleWarnSpy.mockRestore();
    });
  });
});
