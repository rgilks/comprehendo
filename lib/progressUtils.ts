import {
  getProgress,
  initializeProgress,
  updateProgress,
  STREAK_THRESHOLD_FOR_LEVEL_UP,
} from '@/lib/repositories/progressRepository';
import { CEFR_LEVELS, ProgressUpdateResult } from '@/lib/domain/progress';
import { CEFRLevel, CEFR_LEVEL_INDICES } from '@/lib/domain/language-guidance';

// Calculates the next progress state based on the current state and the result of the last interaction.
// This is a pure function, making it easily testable.
const calculateNextProgress = (
  currentLevel: CEFRLevel,
  currentStreak: number,
  isCorrect: boolean
): {
  nextLevel: CEFRLevel;
  nextStreak: number;
  leveledUp: boolean;
} => {
  let nextLevel = currentLevel;
  let nextStreak: number = currentStreak;
  let leveledUp = false;

  if (isCorrect) {
    nextStreak += 1;
    if (nextStreak >= STREAK_THRESHOLD_FOR_LEVEL_UP) {
      const currentLevelIndex = CEFR_LEVEL_INDICES[currentLevel];
      if (currentLevelIndex < CEFR_LEVELS.length - 1) {
        const nextLevelIndex = currentLevelIndex + 1;
        nextLevel = CEFR_LEVELS[nextLevelIndex];
        nextStreak = 0;
        leveledUp = true;
      } else {
        // Already at max level, reset streak to prevent infinite growth
        // Or keep it capped? Resetting seems simpler.
        nextStreak = 0;
      }
    }
  } else {
    nextStreak = 0;
  }

  return { nextLevel, nextStreak, leveledUp };
};

// Fetches current progress, calculates the next state, updates the database, and returns the new state.
export const calculateAndUpdateProgress = (
  userId: number,
  language: string,
  isCorrect: boolean
): ProgressUpdateResult => {
  const languageCode = language.toLowerCase().slice(0, 2);

  try {
    // 1. Get current progress or initialize if it doesn't exist
    let currentProgress = getProgress(userId, languageCode);
    if (!currentProgress) {
      console.log(
        `[calculateAndUpdateProgress] No progress found for user ${userId}, lang ${languageCode}. Initializing.`
      );
      currentProgress = initializeProgress(userId, languageCode);
    }

    // 2. Calculate the next progress state
    const { nextLevel, nextStreak, leveledUp } = calculateNextProgress(
      currentProgress.cefr_level,
      currentProgress.correct_streak,
      isCorrect
    );

    // 3. Update progress in the database
    updateProgress(userId, languageCode, nextLevel, nextStreak);

    // 4. Return the result
    return {
      currentLevel: nextLevel,
      currentStreak: nextStreak,
      leveledUp: leveledUp,
    };
  } catch (error) {
    // Assume error is always an instance of Error based on lint rules
    const message = (error as Error).message; // Cast to Error
    console.error(
      `[calculateAndUpdateProgress] Error for user ${userId}, lang ${languageCode}: ${message}`
    );
    // Rethrow the error to be handled by the caller
    throw error;
  }
};
