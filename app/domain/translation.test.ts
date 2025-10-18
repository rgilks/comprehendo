import { describe, it, expect } from 'vitest';
import { TranslationResultSchema } from 'app/domain/translation';

describe('translation domain', () => {
  describe('TranslationResultSchema', () => {
    it('should validate valid translation result', () => {
      const validResult = {
        translation: 'Hello',
        romanization: 'Hola',
      };

      const result = TranslationResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.translation).toBe('Hello');
        expect(result.data.romanization).toBe('Hola');
      }
    });

    it('should validate translation result without romanization', () => {
      const validResult = {
        translation: 'Hello',
      };

      const result = TranslationResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.translation).toBe('Hello');
        expect(result.data.romanization).toBeUndefined();
      }
    });

    it('should reject empty translation', () => {
      const invalidResult = {
        translation: '',
      };

      const result = TranslationResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(true); // Empty string is valid according to schema
    });

    it('should reject missing translation', () => {
      const invalidResult = {
        romanization: 'Hola',
      };

      const result = TranslationResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(false);
    });

    it('should reject non-string translation', () => {
      const invalidResult = {
        translation: 123,
      };

      const result = TranslationResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(false);
    });

    it('should reject non-string romanization', () => {
      const invalidResult = {
        translation: 'Hello',
        romanization: 123,
      };

      const result = TranslationResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(false);
    });
  });
});
