import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  STREAK_THRESHOLD_FOR_LEVEL_UP,
  getProgress,
  initializeProgress,
  updateProgress,
} from './progressRepository';
import { ProgressSchema, Progress } from '@/lib/domain/progress';
import { CEFRLevel } from '@/lib/domain/language-guidance';

vi.mock('@/lib/drizzle-db', () => ({
  default: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/domain/progress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/domain/progress')>();
  const safeParseMock = vi.fn();

  const proxiedSchema = new Proxy(actual.ProgressSchema, {
    get: (target, prop, receiver) => {
      if (prop === 'safeParse') {
        return safeParseMock;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return {
    ...actual,
    ProgressSchema: proxiedSchema,
  };
});

describe('progressRepository', () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@/lib/drizzle-db');
    mockDb = dbModule.default;
  });

  describe('STREAK_THRESHOLD_FOR_LEVEL_UP', () => {
    it('should be 5', () => {
      expect(STREAK_THRESHOLD_FOR_LEVEL_UP).toBe(5);
    });
  });

  describe('getProgress', () => {
    const userId = 1;
    const languageCode = 'fr';
    const mockDate = new Date();
    const mockRawProgress = {
      userId,
      languageCode,
      cefrLevel: 'A1' as CEFRLevel,
      correctStreak: 0,
      lastPracticed: mockDate.toISOString(),
    };
    const mockParsedProgress: Progress = {
      user_id: userId,
      language_code: languageCode,
      cefr_level: 'A1',
      correct_streak: 0,
      last_practiced: mockDate,
    };

    it('should return progress if found and parsed successfully', async () => {
      mockDb.limit.mockResolvedValue([mockRawProgress]);
      (ProgressSchema.safeParse as import('vitest').Mock).mockReturnValue({
        success: true,
        data: mockParsedProgress,
      });

      const progress = await getProgress(userId, languageCode);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(ProgressSchema.safeParse).toHaveBeenCalledWith({
        ...mockRawProgress,
        last_practiced: new Date(mockRawProgress.lastPracticed),
      });
      expect(progress).toEqual(mockParsedProgress);
    });

    it('should return null if progress not found', async () => {
      mockDb.limit.mockResolvedValue([]);
      const progress = await getProgress(userId, languageCode);
      expect(progress).toBeNull();
      expect(ProgressSchema.safeParse).not.toHaveBeenCalled();
    });

    it('should return null if parsing fails', async () => {
      mockDb.limit.mockResolvedValue([mockRawProgress]);
      (ProgressSchema.safeParse as import('vitest').Mock).mockReturnValue({
        success: false,
        error: { issues: [] },
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const progress = await getProgress(userId, languageCode);

      expect(progress).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error if database query fails', async () => {
      const dbError = new Error('DB Error');
      mockDb.limit.mockRejectedValue(dbError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getProgress(userId, languageCode)).rejects.toThrow(
        `Database error fetching progress for user ${userId}, lang ${languageCode}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[getProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('initializeProgress', () => {
    const userId = 1;
    const languageCode = 'en';
    const expectedInitialProgress: Progress = {
      user_id: userId,
      language_code: languageCode,
      cefr_level: 'A1',
      correct_streak: 0,
      last_practiced: null,
    };

    it('should insert and return initial progress', async () => {
      mockDb.values.mockResolvedValue({ changes: 1 });

      const progress = await initializeProgress(userId, languageCode);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalledWith({
        userId,
        languageCode,
        cefrLevel: 'A1',
        correctStreak: 0,
        lastPracticed: null,
      });
      expect(progress).toEqual(expectedInitialProgress);
    });

    it('should throw an error if database insert fails', async () => {
      const dbError = new Error('DB Insert Error');
      mockDb.values.mockRejectedValue(dbError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(initializeProgress(userId, languageCode)).rejects.toThrow(
        `Database error initializing progress for user ${userId}, lang ${languageCode}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[initializeProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('updateProgress', () => {
    const userId = 1;
    const languageCode = 'de';
    const newLevel: CEFRLevel = 'B1';
    const newStreak = 3;

    it('should update progress successfully', async () => {
      mockDb.where.mockResolvedValue({ changes: 1 });

      await updateProgress(userId, languageCode, newLevel, newStreak);

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cefrLevel: newLevel,
          correctStreak: newStreak,
        })
      );
      expect(mockDb.set.mock.calls[0][0].lastPracticed).toBeInstanceOf(Date);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should warn if no rows were updated', async () => {
      mockDb.where.mockResolvedValue({ changes: 0 });
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await updateProgress(userId, languageCode, newLevel, newStreak);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[updateProgress] No rows updated for user ${userId}, lang ${languageCode}. Progress might not have been initialized.`
      );
      consoleWarnSpy.mockRestore();
    });

    it('should throw an error if database update fails', async () => {
      const dbError = new Error('DB Update Error');
      mockDb.where.mockRejectedValue(dbError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateProgress(userId, languageCode, newLevel, newStreak)).rejects.toThrow(
        `Database error updating progress for user ${userId}, lang ${languageCode}.`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[updateProgress] DB Error for user ${userId}, lang ${languageCode}: ${dbError.message}`
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
