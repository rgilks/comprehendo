import {
  getProgress,
  initializeProgress,
  updateProgress,
  STREAK_THRESHOLD_FOR_LEVEL_UP,
} from '@/lib/repo/progressRepository';
import { CEFR_LEVELS, ProgressUpdateResult } from '@/lib/domain/progress';
import { CEFRLevel, CEFR_LEVEL_INDICES } from '@/lib/domain/language-guidance';

// Calculates the next progress state based on the current state and the result of the last interaction.
// This is a pure function, making it easily testable.
const calculateNextProgress = (
  currentLevel: CEFRLevel,
  currentStreak: number,
  isCorrect: boolean
): { nextLevel: CEFRLevel; nextStreak: number; leveledUp: boolean } => {
  let nextLevel = currentLevel;
  let nextStreak = currentStreak;
  let leveledUp = false;

  if (isCorrect) {
    nextStreak++;
    if (nextStreak >= STREAK_THRESHOLD_FOR_LEVEL_UP) {
      const currentLevelIndex = CEFR_LEVEL_INDICES[currentLevel];
      if (currentLevelIndex < CEFR_LEVELS.length - 1) {
        nextLevel = CEFR_LEVELS[currentLevelIndex + 1];
        nextStreak = 0;
        leveledUp = true;
      } else {
        nextStreak = 0;
      }
    }
  } else {
    nextStreak = 0;
  }

  return { nextLevel, nextStreak, leveledUp };
};

const getOrInitProgress = async (userId: number, languageCode: string) => {
  let currentProgress = await getProgress(userId, languageCode);
  if (!currentProgress) {
    currentProgress = await initializeProgress(userId, languageCode);
  }
  return currentProgress;
};

export const calculateAndUpdateProgress = async (
  userId: number,
  language: string,
  isCorrect: boolean
): Promise<ProgressUpdateResult> => {
  const languageCode = language.toLowerCase().slice(0, 2);
  const currentProgress = await getOrInitProgress(userId, languageCode);

  const { nextLevel, nextStreak, leveledUp } = calculateNextProgress(
    currentProgress.cefr_level,
    currentProgress.correct_streak,
    isCorrect
  );
  await updateProgress(userId, languageCode, nextLevel, nextStreak);
  return {
    currentLevel: nextLevel,
    currentStreak: nextStreak,
    leveledUp,
  };
};
