import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateWordWithGoogle } from './translate';
import type { TranslationResult } from '@/lib/domain/translation';

// Mock the global fetch function
global.fetch = vi.fn();

const mockFetch = (status: number, body: unknown) => {
  vi.mocked(fetch).mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
};

const mockFetchError = (error: Error) => {
  vi.mocked(fetch).mockRejectedValue(error);
};

describe('translateWordWithGoogle', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules(); // Reset modules to clear cache if needed
    process.env = { ...originalEnv }; // Clone env
    vi.clearAllMocks(); // Clear mocks between tests
    process.env['GOOGLE_TRANSLATE_API_KEY'] = 'test-api-key'; // Set default test key
  });

  afterEach(() => {
    process.env = originalEnv; // Restore original env
  });

  it('should return null if word is missing', async () => {
    const result = await translateWordWithGoogle('', 'es', 'en');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return null if targetLang is missing', async () => {
    const result = await translateWordWithGoogle('hello', '', 'en');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return null if sourceLang is missing', async () => {
    // Note: sourceLang is optional in the call, but required logic inside
    const result = await translateWordWithGoogle('hello', 'es', '');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return null if GOOGLE_TRANSLATE_API_KEY is not configured', async () => {
    delete process.env['GOOGLE_TRANSLATE_API_KEY'];
    const result = await translateWordWithGoogle('hello', 'es', 'en');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should return translation result on successful API call', async () => {
    const mockResponse = {
      data: {
        translations: [{ translatedText: 'hola' }],
      },
    };
    mockFetch(200, mockResponse);

    const expectedResult: TranslationResult = {
      translation: 'hola',
      romanization: '',
    };
    const result = await translateWordWithGoogle('hello', 'es', 'en');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://translation.googleapis.com/language/translate/v2?key=test-api-key'
      ),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: 'hello', target: 'es', format: 'text', source: 'en' }),
      })
    );
    expect(result).toEqual(expectedResult);
  });

  it('should handle API response with error object', async () => {
    const mockErrorResponse = {
      error: {
        code: 400,
        message: 'Invalid target language',
        errors: [{ message: 'Invalid Value', domain: 'global', reason: 'invalid' }],
      },
    };
    mockFetch(400, mockErrorResponse);

    const result = await translateWordWithGoogle('hello', 'xx', 'en');
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should handle API response with non-ok status but no error object', async () => {
    mockFetch(500, { message: 'Internal Server Error' }); // Simulate server error with generic message

    const result = await translateWordWithGoogle('hello', 'es', 'en');
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should return null if API response has no translations', async () => {
    const mockResponse = {
      data: {
        translations: [], // Empty translations array
      },
    };
    mockFetch(200, mockResponse);

    const result = await translateWordWithGoogle('hello', 'es', 'en');
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should return null if fetch throws an error', async () => {
    mockFetchError(new Error('Network failure'));

    const result = await translateWordWithGoogle('hello', 'es', 'en');
    expect(result).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('should call API without source language if provided as empty string initially (but fails validation)', async () => {
    // This test primarily checks the internal logic flow before validation catches it
    const result = await translateWordWithGoogle('hello', 'es', '');
    expect(result).toBeNull(); // Fails validation before API call
    expect(fetch).not.toHaveBeenCalled();
  });
});
