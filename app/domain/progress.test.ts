import { describe, it, expect } from 'vitest';
import { ProgressSchema, ProgressUpdateResultSchema, CEFR_LEVELS } from 'app/domain/progress';

describe('progress domain', () => {
  describe('ProgressSchema', () => {
    it('should validate valid progress data', () => {
      const validProgress = {
        user_id: 1,
        language_code: 'en',
        cefr_level: 'B1',
        correct_streak: 5,
        last_practiced: new Date(),
      };

      const result = ProgressSchema.safeParse(validProgress);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user_id).toBe(1);
        expect(result.data.language_code).toBe('en');
        expect(result.data.cefr_level).toBe('B1');
        expect(result.data.correct_streak).toBe(5);
      }
    });

    it('should validate progress with null last_practiced', () => {
      const validProgress = {
        user_id: 1,
        language_code: 'en',
        cefr_level: 'B1',
        correct_streak: 0,
        last_practiced: null,
      };

      const result = ProgressSchema.safeParse(validProgress);

      expect(result.success).toBe(true);
    });

    it('should reject invalid user_id', () => {
      const invalidProgress = {
        user_id: 'invalid' as unknown as number,
        language_code: 'en',
        cefr_level: 'B1',
        correct_streak: 5,
        last_practiced: null,
      };

      const result = ProgressSchema.safeParse(invalidProgress);

      expect(result.success).toBe(false);
    });

    it('should reject invalid language_code length', () => {
      const invalidProgress = {
        user_id: 1,
        language_code: 'english',
        cefr_level: 'B1',
        correct_streak: 5,
      };

      const result = ProgressSchema.safeParse(invalidProgress);

      expect(result.success).toBe(false);
    });

    it('should reject invalid cefr_level', () => {
      const invalidProgress = {
        user_id: 1,
        language_code: 'en',
        cefr_level: 'X1',
        correct_streak: 5,
      };

      const result = ProgressSchema.safeParse(invalidProgress);

      expect(result.success).toBe(false);
    });

    it('should reject negative correct_streak', () => {
      const invalidProgress = {
        user_id: 1,
        language_code: 'en',
        cefr_level: 'B1',
        correct_streak: -1,
      };

      const result = ProgressSchema.safeParse(invalidProgress);

      expect(result.success).toBe(false);
    });
  });

  describe('ProgressUpdateResultSchema', () => {
    it('should validate valid progress update result', () => {
      const validResult = {
        currentLevel: 'B1',
        currentStreak: 5,
        leveledUp: true,
      };

      const result = ProgressUpdateResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentLevel).toBe('B1');
        expect(result.data.currentStreak).toBe(5);
        expect(result.data.leveledUp).toBe(true);
      }
    });

    it('should validate result with error', () => {
      const validResult = {
        currentLevel: 'B1',
        currentStreak: 5,
        leveledUp: false,
        error: 'Some error message',
      };

      const result = ProgressUpdateResultSchema.safeParse(validResult);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.error).toBe('Some error message');
      }
    });

    it('should reject invalid currentLevel', () => {
      const invalidResult = {
        currentLevel: 'X1',
        currentStreak: 5,
        leveledUp: true,
      };

      const result = ProgressUpdateResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(false);
    });

    it('should reject negative currentStreak', () => {
      const invalidResult = {
        currentLevel: 'B1',
        currentStreak: -1,
        leveledUp: true,
      };

      const result = ProgressUpdateResultSchema.safeParse(invalidResult);

      expect(result.success).toBe(false);
    });
  });

  describe('CEFR_LEVELS', () => {
    it('should export CEFR_LEVELS', () => {
      expect(CEFR_LEVELS).toBeDefined();
      expect(Array.isArray(CEFR_LEVELS)).toBe(true);
      expect(CEFR_LEVELS.length).toBeGreaterThan(0);
    });

    it('should contain expected CEFR levels', () => {
      const expectedLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

      expectedLevels.forEach((level) => {
        expect(CEFR_LEVELS).toContain(level);
      });
    });
  });
});
