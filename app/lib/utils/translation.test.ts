import { describe, it, expect } from 'vitest';
import {
  getCacheKey,
  analyzeTranslation,
  canTranslate,
  type TranslationParams,
} from 'app/lib/utils/translation';

describe('translation utils', () => {
  describe('getCacheKey', () => {
    it('should create cache key with cleaned word', () => {
      const result = getCacheKey('Hello', 'en', 'es');
      expect(result).toBe('en:es:hello');
    });

    it('should handle words with spaces and special characters', () => {
      const result = getCacheKey('  Hello World!  ', 'en', 'es');
      expect(result).toBe('en:es:hello world!');
    });

    it('should handle different language combinations', () => {
      const result = getCacheKey('test', 'fr', 'de');
      expect(result).toBe('fr:de:test');
    });
  });

  describe('analyzeTranslation', () => {
    it('should return shouldTranslate false for same languages', () => {
      const params: TranslationParams = {
        word: 'hello',
        fromLang: 'en',
        toLang: 'en',
        translationCache: new Map(),
      };

      const result = analyzeTranslation(params);

      expect(result.shouldTranslate).toBe(false);
      expect(result.cacheKey).toBeNull();
      expect(result.cachedTranslation).toBeNull();
    });

    it('should return shouldTranslate true for different languages', () => {
      const params: TranslationParams = {
        word: 'hello',
        fromLang: 'en',
        toLang: 'es',
        translationCache: new Map(),
      };

      const result = analyzeTranslation(params);

      expect(result.shouldTranslate).toBe(true);
      expect(result.cacheKey).toBe('en:es:hello');
      expect(result.cachedTranslation).toBeNull();
    });

    it('should return cached translation when available', () => {
      const cache = new Map();
      cache.set('en:es:hello', 'hola');

      const params: TranslationParams = {
        word: 'hello',
        fromLang: 'en',
        toLang: 'es',
        translationCache: cache,
      };

      const result = analyzeTranslation(params);

      expect(result.shouldTranslate).toBe(true);
      expect(result.cacheKey).toBe('en:es:hello');
      expect(result.cachedTranslation).toBe('hola');
    });
  });

  describe('canTranslate', () => {
    it('should allow translation in initial phase', () => {
      const result = canTranslate('initial', 0, false, null);
      expect(result).toBe(true);
    });

    it('should allow translation when credits available', () => {
      const result = canTranslate('credits', 5, false, null);
      expect(result).toBe(true);
    });

    it('should not allow translation when loading', () => {
      const result = canTranslate('credits', 5, true, null);
      expect(result).toBe(false);
    });

    it('should not allow translation when already translated', () => {
      const result = canTranslate('credits', 5, false, 'hola');
      expect(result).toBe(false);
    });

    it('should not allow translation when no credits in credits phase', () => {
      const result = canTranslate('credits', 0, false, null);
      expect(result).toBe(false);
    });
  });
});
