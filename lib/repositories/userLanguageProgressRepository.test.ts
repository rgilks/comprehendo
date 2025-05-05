import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import {
  getUserLanguageProgress,
  initializeUserLanguageProgress,
  updateUserLanguageProgress,
  STREAK_THRESHOLD_FOR_LEVEL_UP,
} from './userLanguageProgressRepository';
import db from '@/lib/db'; // Import the actual db to mock it
import { UserLanguageProgress } from '@/lib/domain/progress';
import { CEFRLevel } from '@/lib/domain/language-guidance';

// Mock the db module
vi.mock('@/lib/db', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnThis(),
    get: vi.fn(),
    run: vi.fn(),
  };
  // Chain mock methods
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb };
});

// Create typed mock functions
const mockPrepare = db.prepare as Mock;
const mockGet = (db.prepare as any)().get as Mock;
const mockRun = (db.prepare as any)().run as Mock;

describe('userLanguageProgressRepository', () => {
  const userId = 1;
  const languageCode = 'en';
  const mockDate = new Date('2023-01-01T12:00:00.000Z');
  const mockDateISO = mockDate.toISOString();

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    mockPrepare.mockClear();
    mockGet.mockClear();
    mockRun.mockClear();

    // Reset default implementations if needed (chaining requires re-mocking)
    mockPrepare.mockImplementation(() => ({
      get: mockGet,
      run: mockRun,
    }));
  });

  // Test STREAK_THRESHOLD_FOR_LEVEL_UP export
  it('should export STREAK_THRESHOLD_FOR_LEVEL_UP with the correct value', () => {
    expect(STREAK_THRESHOLD_FOR_LEVEL_UP).toBe(5);
  });

  describe('getUserLanguageProgress', () => {
    it('should return user progress when found and valid', () => {
      const rawProgress = {
        user_id: userId,
        language_code: languageCode,
        cefr_level: 'A2' as CEFRLevel,
        correct_streak: 3,
        last_practiced: mockDateISO,
      };
      mockGet.mockReturnValue(rawProgress);

      const result = getUserLanguageProgress(userId, languageCode);
      const expectedProgress: UserLanguageProgress = {
        ...rawProgress,
        last_practiced: mockDate,
      };

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockGet).toHaveBeenCalledWith(userId, languageCode);
      expect(result).toEqual(expectedProgress);
    });

    it('should return null when user progress is not found', () => {
      mockGet.mockReturnValue(undefined);

      const result = getUserLanguageProgress(userId, languageCode);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockGet).toHaveBeenCalledWith(userId, languageCode);
      expect(result).toBeNull();
    });

    it('should return null and log error when data parsing fails', () => {
      const invalidRawProgress = {
        user_id: userId,
        language_code: languageCode,
        cefr_level: 'InvalidLevel', // Invalid level
        correct_streak: -1, // Invalid streak
        last_practiced: 'not-a-date', // Invalid date string
      };
      mockGet.mockReturnValue(invalidRawProgress);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error

      const result = getUserLanguageProgress(userId, languageCode);

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockGet).toHaveBeenCalledWith(userId, languageCode);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[getUserLanguageProgress] Failed to parse progress'),
        expect.any(Object) // Zod error details
      );
      consoleErrorSpy.mockRestore();
    });

    it('should handle null last_practiced date correctly', () => {
      const rawProgress = {
        user_id: userId,
        language_code: languageCode,
        cefr_level: 'B1' as CEFRLevel,
        correct_streak: 0,
        last_practiced: null,
      };
      mockGet.mockReturnValue(rawProgress);

      const result = getUserLanguageProgress(userId, languageCode);
      const expectedProgress: UserLanguageProgress = {
        ...rawProgress,
        last_practiced: null,
      };

      expect(mockGet).toHaveBeenCalledWith(userId, languageCode);
      expect(result).toEqual(expectedProgress);
    });

    it('should throw an error when the database query fails', () => {
      const dbError = new Error('Database connection failed');
      mockGet.mockImplementation(() => {
        throw dbError;
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console error

      expect(() => {
        getUserLanguageProgress(userId, languageCode);
      }).toThrow(`Database error fetching progress for user ${userId}, lang ${languageCode}.`);
      expect(mockGet).toHaveBeenCalledWith(userId, languageCode);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[getUserLanguageProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
        )
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('initializeUserLanguageProgress', () => {
    it('should insert initial progress and return the progress object', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 123 }); // Simulate successful insert

      const result = initializeUserLanguageProgress(userId, languageCode);
      const expectedInitialProgress: UserLanguageProgress = {
        user_id: userId,
        language_code: languageCode,
        cefr_level: 'A1',
        correct_streak: 0,
        last_practiced: null,
      };

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'));
      expect(mockRun).toHaveBeenCalledWith(userId, languageCode, 'A1', 0);
      expect(result).toEqual(expectedInitialProgress);
    });

    it('should throw an error when the database insertion fails', () => {
      const dbError = new Error('Insertion failed');
      mockRun.mockImplementation(() => {
        throw dbError;
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        initializeUserLanguageProgress(userId, languageCode);
      }).toThrow(`Database error initializing progress for user ${userId}, lang ${languageCode}.`);
      expect(mockRun).toHaveBeenCalledWith(userId, languageCode, 'A1', 0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[initializeUserLanguageProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
        )
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateUserLanguageProgress', () => {
    const newLevel: CEFRLevel = 'B1';
    const newStreak = 5;

    it('should update user progress successfully', () => {
      mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 });

      expect(() => {
        updateUserLanguageProgress(userId, languageCode, newLevel, newStreak);
      }).not.toThrow();

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE'));
      expect(mockRun).toHaveBeenCalledWith(newLevel, newStreak, userId, languageCode);
    });

    it('should log a warning if no rows are updated', () => {
      mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 }); // Simulate no rows updated
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        updateUserLanguageProgress(userId, languageCode, newLevel, newStreak);
      }).not.toThrow();

      expect(mockRun).toHaveBeenCalledWith(newLevel, newStreak, userId, languageCode);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[updateUserLanguageProgress] No rows updated')
      );
      consoleWarnSpy.mockRestore();
    });

    it('should throw an error when the database update fails', () => {
      const dbError = new Error('Update failed');
      mockRun.mockImplementation(() => {
        throw dbError;
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        updateUserLanguageProgress(userId, languageCode, newLevel, newStreak);
      }).toThrow(`Database error updating progress for user ${userId}, lang ${languageCode}.`);
      expect(mockRun).toHaveBeenCalledWith(newLevel, newStreak, userId, languageCode);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `[updateUserLanguageProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
        )
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
