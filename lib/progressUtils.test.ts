import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { calculateAndUpdateProgress } from './progressUtils'; // Import the function to test
import {
  getUserLanguageProgress,
  initializeUserLanguageProgress,
  updateUserLanguageProgress,
  STREAK_THRESHOLD_FOR_LEVEL_UP,
} from '@/lib/repositories/userLanguageProgressRepository';
import { UserLanguageProgress } from '@/lib/domain/progress';
import { CEFRLevel } from '@/lib/domain/language-guidance';

// Mock the repository functions
vi.mock('@/lib/repositories/userLanguageProgressRepository', () => ({
  getUserLanguageProgress: vi.fn(),
  initializeUserLanguageProgress: vi.fn(),
  updateUserLanguageProgress: vi.fn(),
  // Keep the constant accessible
  STREAK_THRESHOLD_FOR_LEVEL_UP: 5, // Assuming 5, replace with actual if different
}));

// Helper to create mock progress
const createMockProgress = (level: CEFRLevel, streak: number): UserLanguageProgress => ({
  user_id: 1,
  language_code: 'en',
  cefr_level: level,
  correct_streak: streak,
  last_practiced: new Date(),
});

describe('calculateAndUpdateProgress', () => {
  const userId = 1;
  const language = 'en';
  const languageCode = 'en';

  // Reset mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return updated progress when answer is correct and streak is below threshold', () => {
    const currentProgress = createMockProgress('A1', 2);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);

    const result = calculateAndUpdateProgress(userId, language, true);

    expect(getUserLanguageProgress).toHaveBeenCalledWith(userId, languageCode);
    expect(initializeUserLanguageProgress).not.toHaveBeenCalled();
    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'A1', // Expected next level
      3 // Expected next streak
    );
    expect(result).toEqual({
      currentLevel: 'A1',
      currentStreak: 3,
      leveledUp: false,
    });
  });

  it('should level up when answer is correct and streak meets threshold', () => {
    const currentProgress = createMockProgress('A1', STREAK_THRESHOLD_FOR_LEVEL_UP - 1);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);

    const result = calculateAndUpdateProgress(userId, language, true);

    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'A2', // Expected next level
      0 // Expected next streak (reset)
    );
    expect(result).toEqual({
      currentLevel: 'A2',
      currentStreak: 0,
      leveledUp: true,
    });
  });

  it('should reset streak to 0 but not level up when answer is correct, streak meets threshold, but already at max level (C2)', () => {
    const currentProgress = createMockProgress('C2', STREAK_THRESHOLD_FOR_LEVEL_UP - 1);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);

    const result = calculateAndUpdateProgress(userId, language, true);

    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'C2', // Expected next level (still C2)
      0 // Expected next streak (reset)
    );
    expect(result).toEqual({
      currentLevel: 'C2',
      currentStreak: 0,
      leveledUp: false, // Not technically a level up from C2
    });
  });

  it('should reset streak when answer is incorrect', () => {
    const currentProgress = createMockProgress('B1', 3);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);

    const result = calculateAndUpdateProgress(userId, language, false);

    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'B1', // Expected next level (no change)
      0 // Expected next streak (reset)
    );
    expect(result).toEqual({
      currentLevel: 'B1',
      currentStreak: 0,
      leveledUp: false,
    });
  });

  it('should initialize progress if none exists and update based on correct answer', () => {
    (getUserLanguageProgress as Mock).mockReturnValue(null);
    const initialProgress = createMockProgress('A1', 0); // Default initial state
    (initializeUserLanguageProgress as Mock).mockReturnValue(initialProgress);

    const result = calculateAndUpdateProgress(userId, language, true);

    expect(getUserLanguageProgress).toHaveBeenCalledWith(userId, languageCode);
    expect(initializeUserLanguageProgress).toHaveBeenCalledWith(userId, languageCode);
    // Update based on the *initialized* progress (A1, 0) + correct answer
    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'A1', // Still A1
      1 // Streak becomes 1
    );
    expect(result).toEqual({
      currentLevel: 'A1',
      currentStreak: 1,
      leveledUp: false,
    });
  });

  it('should initialize progress if none exists and update based on incorrect answer', () => {
    (getUserLanguageProgress as Mock).mockReturnValue(null);
    const initialProgress = createMockProgress('A1', 0);
    (initializeUserLanguageProgress as Mock).mockReturnValue(initialProgress);

    const result = calculateAndUpdateProgress(userId, language, false);

    expect(initializeUserLanguageProgress).toHaveBeenCalledWith(userId, languageCode);
    // Update based on the *initialized* progress (A1, 0) + incorrect answer
    expect(updateUserLanguageProgress).toHaveBeenCalledWith(
      userId,
      languageCode,
      'A1', // Still A1
      0 // Streak stays 0
    );
    expect(result).toEqual({
      currentLevel: 'A1',
      currentStreak: 0,
      leveledUp: false,
    });
  });

  it('should handle language codes correctly (case-insensitivity and length)', () => {
    const currentProgress = createMockProgress('A1', 1);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);

    calculateAndUpdateProgress(userId, 'Français', true); // Use longer, mixed-case language name

    expect(getUserLanguageProgress).toHaveBeenCalledWith(userId, 'fr'); // Should use lowercase, 2-char code
    expect(updateUserLanguageProgress).toHaveBeenCalledWith(userId, 'fr', 'A1', 2);
  });

  it('should rethrow errors from getUserLanguageProgress', () => {
    const testError = new Error('DB read failed');
    (getUserLanguageProgress as Mock).mockImplementation(() => {
      throw testError;
    });

    expect(() => calculateAndUpdateProgress(userId, language, true)).toThrow(testError);
    expect(initializeUserLanguageProgress).not.toHaveBeenCalled();
    expect(updateUserLanguageProgress).not.toHaveBeenCalled();
  });

  it('should rethrow errors from initializeUserLanguageProgress', () => {
    (getUserLanguageProgress as Mock).mockReturnValue(null);
    const testError = new Error('DB init failed');
    (initializeUserLanguageProgress as Mock).mockImplementation(() => {
      throw testError;
    });

    expect(() => calculateAndUpdateProgress(userId, language, true)).toThrow(testError);
    expect(updateUserLanguageProgress).not.toHaveBeenCalled();
  });

  it('should rethrow errors from updateUserLanguageProgress', () => {
    const currentProgress = createMockProgress('A1', 2);
    (getUserLanguageProgress as Mock).mockReturnValue(currentProgress);
    const testError = new Error('DB write failed');
    (updateUserLanguageProgress as Mock).mockImplementation(() => {
      throw testError;
    });

    expect(() => calculateAndUpdateProgress(userId, language, true)).toThrow(testError);
  });

  /* // Removed test for non-Error exceptions as the corresponding code path was removed
   it('should handle non-Error exceptions from repository functions', () => {
    const currentProgress = createMockProgress('A1', 2);
    (getUserLanguageProgress as vi.Mock).mockReturnValue(currentProgress);
    const nonErrorCause = { problem: 'Something weird happened' };
    (updateUserLanguageProgress as vi.Mock).mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw nonErrorCause; // Simulate throwing something other than an Error
    });

    try {
      calculateAndUpdateProgress(userId, language, true);
      // Should not reach here
      expect.fail('Expected an exception to be thrown');
    } catch (e) {
      // We expect the original non-Error cause to be re-thrown
      expect(e).toBe(nonErrorCause);
    }

    // Ensure the console.error was still called (which uses the ternary operator)
    // We can't directly check console output easily in Vitest without spies,
    // but reaching here confirms the catch block was entered and the specific line
    // we want to cover was executed before the re-throw.
   });
   */
});

// Note: calculateNextProgress is implicitly tested via calculateAndUpdateProgress
// as calculateAndUpdateProgress calls it directly with the results from the (mocked) DB.
// If calculateNextProgress were more complex or exported separately for other uses,
// dedicated unit tests for it might be beneficial.
