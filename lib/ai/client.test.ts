import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';

// Mock the GoogleGenAI class
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    // Mock any methods needed by the client users if necessary
    getGenerativeModel: vi.fn(),
  })),
}));

describe('getGoogleAIClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to clear the singleton instance between tests
    vi.resetModules();
    // Mock process.env
    process.env = { ...originalEnv };
    // Clear mock calls
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  it('should throw an error if GOOGLE_AI_API_KEY is not set', async () => {
    delete process.env['GOOGLE_AI_API_KEY'];
    // Dynamically import after resetting modules and modifying env
    const importClient = async () => await import('./client');

    await expect(importClient().then((module) => module.getGoogleAIClient())).rejects.toThrow(
      '[GoogleAI Client] CRITICAL: GOOGLE_AI_API_KEY environment variable is not set. Cannot initialize client.'
    );
  });

  it('should initialize and return a GoogleGenAI client if GOOGLE_AI_API_KEY is set', async () => {
    process.env['GOOGLE_AI_API_KEY'] = 'test-api-key';
    // Dynamically import after resetting modules and modifying env
    const { getGoogleAIClient } = await import('./client');
    const client = getGoogleAIClient();

    expect(client).toBeDefined();
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('should return the same client instance on subsequent calls', async () => {
    process.env['GOOGLE_AI_API_KEY'] = 'test-api-key';
    // Dynamically import after resetting modules and modifying env
    const { getGoogleAIClient } = await import('./client');

    const client1 = getGoogleAIClient();
    const client2 = getGoogleAIClient();

    expect(client1).toBe(client2);
    // Constructor should only be called once due to singleton pattern
    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during GoogleGenAI instantiation', async () => {
    process.env['GOOGLE_AI_API_KEY'] = 'test-api-key';
    const instantiationError = new Error('Failed to instantiate');
    vi.mocked(GoogleGenAI).mockImplementationOnce(() => {
      throw instantiationError;
    });

    // Dynamically import after resetting modules and modifying env
    const importClient = async () => await import('./client');

    await expect(importClient().then((module) => module.getGoogleAIClient())).rejects.toThrow(
      instantiationError
    );
  });
});
