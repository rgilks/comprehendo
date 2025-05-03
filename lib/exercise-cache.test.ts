import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the functions to test
import {
  getCachedExercise,
  saveExerciseToCache,
  countCachedExercises,
  type QuizRow,
} from './exercise-cache';

// Import the manual mock instance
import mockDb from './__mocks__/db';

// Explicitly tell Vitest to use the manual mock for the aliased path
vi.mock('@/lib/db');

describe('Exercise Cache Functions', () => {
  const passageLanguage = 'en';
  const questionLanguage = 'en';
  const level = 'B1';
  const userId = 1;
  const anonUserId = null;
  const jsonContent = '{ "key": "value" }';
  const mockQuizRow: QuizRow = {
    id: 123,
    language: passageLanguage,
    level: level,
    content: jsonContent,
    created_at: new Date().toISOString(),
    question_language: questionLanguage,
  };

  beforeEach(() => {
    // Reset mocks before each test
    mockDb.prepare.mockClear().mockReturnThis();
    mockDb.get.mockClear();
    mockDb.run.mockClear();
    // Default mock return values
    mockDb.get.mockReturnValue(undefined); // Default: nothing found
  });

  describe('getCachedExercise', () => {
    it('should return a quiz row for a logged-in user when found', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);
      expect(result).toEqual(mockQuizRow);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(userId, passageLanguage, questionLanguage, level);
    });

    it('should return undefined for a logged-in user when not found', () => {
      // Default mockDb.get returns undefined
      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);
      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(userId, passageLanguage, questionLanguage, level);
    });

    it('should return a quiz row for an anonymous user when found', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      const result = getCachedExercise(passageLanguage, questionLanguage, level, anonUserId);
      expect(result).toEqual(mockQuizRow);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return undefined for an anonymous user when not found', () => {
      // Default mockDb.get returns undefined
      const result = getCachedExercise(passageLanguage, questionLanguage, level, anonUserId);
      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return undefined on database error', () => {
      const dbError = new Error('DB Select Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error getting cached exercise:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('saveExerciseToCache', () => {
    it('should return the new quiz ID on successful insert', () => {
      const expectedId = 456;
      mockDb.get.mockReturnValue({ id: expectedId }); // Mock the RETURNING id part

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBe(expectedId);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(mockDb.get).toHaveBeenCalledWith(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );
    });

    it('should handle null userId correctly during insert', () => {
      const expectedId = 789;
      mockDb.get.mockReturnValue({ id: expectedId });

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        anonUserId
      );

      expect(result).toBe(expectedId);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(mockDb.get).toHaveBeenCalledWith(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        null
      ); // Ensure null is passed
    });

    it('should return undefined if insert fails to return an ID', () => {
      mockDb.get.mockReturnValue(undefined); // Simulate insert failing silently or RETURNING not working
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get ID after saving to cache')
      );
      errorSpy.mockRestore();
    });

    it('should return undefined on database error', () => {
      const dbError = new Error('DB Insert Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      }); // Make the .get() after prepare throw
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error saving exercise to cache:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('countCachedExercises', () => {
    it('should return the count when found', () => {
      const expectedCount = 5;
      mockDb.get.mockReturnValue({ count: expectedCount });

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(expectedCount);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return 0 if no count is found', () => {
      mockDb.get.mockReturnValue(undefined); // Simulate no row returned

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(0);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return 0 on database error', () => {
      const dbError = new Error('DB Count Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error counting cached exercises:', dbError);
      errorSpy.mockRestore();
    });
  });
});
