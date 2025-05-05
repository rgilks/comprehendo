import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { callGoogleAI, AIResponseProcessingError } from './google-ai-api';
import { getGoogleAIClient } from '@/lib/ai/client';

// Mock the client getter
vi.mock('@/lib/ai/client', () => ({
  getGoogleAIClient: vi.fn(),
}));

// Mock the GoogleGenAI class and its methods
const mockGenerateContent = vi.fn();
const mockGoogleGenAI = {
  models: {
    generateContent: mockGenerateContent,
  },
};

describe('callGoogleAI', () => {
  const mockedGetGoogleAIClient = vi.mocked(getGoogleAIClient);

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    // Mock implementation for getGoogleAIClient
    mockedGetGoogleAIClient.mockReturnValue(mockGoogleGenAI);
    // Reset environment variable mock if necessary
    delete process.env['GOOGLE_AI_GENERATION_MODEL'];
  });

  afterEach(() => {
    // Clean up env vars
    delete process.env['GOOGLE_AI_GENERATION_MODEL'];
  });

  it('should return parsed JSON object when response is valid JSON without fences', async () => {
    const mockResponse = { text: '{"key": "value"}' };
    mockGenerateContent.mockResolvedValue(mockResponse);
    const result = await callGoogleAI('test prompt');
    expect(result).toEqual({ key: 'value' });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should return parsed JSON array when response is valid JSON array without fences', async () => {
    const mockResponse = { text: '[1, 2, 3]' };
    mockGenerateContent.mockResolvedValue(mockResponse);
    const result = await callGoogleAI('test prompt');
    expect(result).toEqual([1, 2, 3]);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should return parsed JSON object when response is valid JSON with fences', async () => {
    const mockResponse = { text: '```json\n{"key": "value"}\n```' };
    mockGenerateContent.mockResolvedValue(mockResponse);
    const result = await callGoogleAI('test prompt');
    expect(result).toEqual({ key: 'value' });
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('should use the environment variable for model name if set', async () => {
    process.env['GOOGLE_AI_GENERATION_MODEL'] = 'test-model-from-env';
    const mockResponse = { text: '{}' }; // Minimal valid JSON
    mockGenerateContent.mockResolvedValue(mockResponse);
    await callGoogleAI('test prompt');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'test-model-from-env' })
    );
  });

  it('should use the default model name if environment variable is not set', async () => {
    const mockResponse = { text: '{}' }; // Minimal valid JSON
    mockGenerateContent.mockResolvedValue(mockResponse);
    // Mock console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await callGoogleAI('test prompt');
    // Check if called with the default model name (adjust if default changes)
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-2.5-flash-preview-04-17' })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('GOOGLE_AI_GENERATION_MODEL environment variable not set')
    );
    warnSpy.mockRestore(); // Restore console.warn
  });

  it('should throw AIResponseProcessingError if response text is undefined', async () => {
    const mockResponse = { text: undefined }; // Simulate missing text
    mockGenerateContent.mockResolvedValue(mockResponse);
    await expect(callGoogleAI('test prompt')).rejects.toThrow(
      new AIResponseProcessingError(
        'AI generation failed: No content received from Google AI or failed to extract text.',
        new AIResponseProcessingError(
          'No content received from Google AI or failed to extract text.'
        )
      )
    );
  });

  it('should throw AIResponseProcessingError if response text is not JSON and not fenced', async () => {
    const mockResponse = { text: 'this is not json' };
    mockGenerateContent.mockResolvedValue(mockResponse);
    await expect(callGoogleAI('test prompt')).rejects.toThrow(
      new AIResponseProcessingError(
        'AI generation failed: AI response received, but failed to extract valid JSON content.',
        new AIResponseProcessingError(
          'AI response received, but failed to extract valid JSON content.'
        )
      )
    );
  });

  it('should throw AIResponseProcessingError if fenced content is not valid JSON', async () => {
    const mockResponse = { text: '```json\ninvalid json here\n```' };
    mockGenerateContent.mockResolvedValue(mockResponse);
    // Expect the outer wrapped error with the SyntaxError as the originalError
    await expect(callGoogleAI('test prompt')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(AIResponseProcessingError);
      if (error instanceof AIResponseProcessingError) {
        expect(error.message).toBe('AI generation failed: Failed to parse JSON from AI response.');
        expect(error.originalError).toBeInstanceOf(SyntaxError);
        return true;
      }
      return false;
    });
  });

  it('should throw AIResponseProcessingError if generateContent throws a generic error', async () => {
    const genericError = new Error('API call failed');
    mockGenerateContent.mockRejectedValue(genericError);
    await expect(callGoogleAI('test prompt')).rejects.toThrow(
      new AIResponseProcessingError(`AI generation failed: ${genericError.message}`, genericError)
    );
  });

  it('should throw AIResponseProcessingError with safety message if generateContent throws a SAFETY error', async () => {
    const safetyError = new Error('Blocked due to SAFETY settings');
    mockGenerateContent.mockRejectedValue(safetyError);
    await expect(callGoogleAI('test prompt')).rejects.toThrow(
      new AIResponseProcessingError(
        `Safety setting blocked response: ${safetyError.message}`,
        safetyError
      )
    );
  });

  it('should throw AIResponseProcessingError if generateContent throws a non-Error object', async () => {
    const nonErrorObject = { code: 500, reason: 'Internal Error' };
    mockGenerateContent.mockRejectedValue(nonErrorObject);
    // We expect the message to be generic, and the original object to be passed
    await expect(callGoogleAI('test prompt')).rejects.toThrow(
      new AIResponseProcessingError(
        'AI generation failed: Unknown AI generation error',
        nonErrorObject
      )
    );
  });

  it('should throw AIResponseProcessingError if getGoogleAIClient throws', async () => {
    const clientError = new Error('Failed to initialize client');
    mockedGetGoogleAIClient.mockImplementation(() => {
      throw clientError;
    });
    // Since getGoogleAIClient throws *before* the main try/catch,
    // the raw error should be thrown, not wrapped.
    await expect(callGoogleAI('test prompt')).rejects.toThrow(clientError);
  });
});

describe('AIResponseProcessingError', () => {
  it('should correctly construct with only message', () => {
    const message = 'Test error message';
    const error = new AIResponseProcessingError(message);
    expect(error.message).toBe(message);
    expect(error.name).toBe('AIResponseProcessingError');
    expect(error.originalError).toBeUndefined();
  });

  it('should correctly construct with message and original error', () => {
    const message = 'Test error message';
    const originalError = new Error('Original cause');
    const error = new AIResponseProcessingError(message, originalError);
    expect(error.message).toBe(message);
    expect(error.name).toBe('AIResponseProcessingError');
    expect(error.originalError).toBe(originalError);
  });
});
