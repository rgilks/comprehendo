import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translateWordWithGoogle } from './translate';
import type { TranslationResult } from '@/lib/domain/translation';

global.fetch = vi.fn();

describe('translateWordWithGoogle', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    process.env['GOOGLE_TRANSLATE_API_KEY'] = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns null if word is missing', async () => {
    expect(await translateWordWithGoogle('', 'es', 'en')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null if targetLang is missing', async () => {
    expect(await translateWordWithGoogle('hello', '', 'en')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null if sourceLang is missing', async () => {
    expect(await translateWordWithGoogle('hello', 'es', '')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns null if GOOGLE_TRANSLATE_API_KEY is not configured', async () => {
    delete process.env['GOOGLE_TRANSLATE_API_KEY'];
    expect(await translateWordWithGoogle('hello', 'es', 'en')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns translation result on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { translations: [{ translatedText: 'hola' }] } }),
    } as Response);
    const expected: TranslationResult = { translation: 'hola', romanization: '' };
    const result = await translateWordWithGoogle('hello', 'es', 'en');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expected);
  });

  it('returns null if API error object', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 400 } }),
    } as Response);
    expect(await translateWordWithGoogle('hello', 'xx', 'en')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null if API response has no translations', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { translations: [] } }),
    } as Response);
    expect(await translateWordWithGoogle('hello', 'es', 'en')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null if fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fail'));
    expect(await translateWordWithGoogle('hello', 'es', 'en')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
