import db from '@/lib/db';

export const CEFR_LEVELS: ReadonlyArray<string> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const calculateAndUpdateProgress = (
  userId: number,
  language: string,
  isCorrect: boolean
): { currentLevel: string; currentStreak: number; leveledUp: boolean; error?: string } => {
  const normalizedLanguage = language.toLowerCase().slice(0, 2);

  try {
    const userProgress = db
      .prepare(
        'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, normalizedLanguage) as
      | { cefr_level: string; correct_streak: number }
      | undefined;

    let current_cefr_level: string;
    let correct_streak: number;

    if (!userProgress) {
      db.prepare('INSERT INTO user_language_progress (user_id, language_code) VALUES (?, ?)').run(
        userId,
        normalizedLanguage
      );
      current_cefr_level = 'A1';
      correct_streak = 0;
    } else {
      current_cefr_level = userProgress.cefr_level;
      correct_streak = userProgress.correct_streak;
    }

    let leveledUp = false;
    if (isCorrect) {
      correct_streak += 1;
      if (correct_streak >= 5) {
        const currentLevelIndex = CEFR_LEVELS.indexOf(current_cefr_level);
        if (currentLevelIndex !== -1 && currentLevelIndex < CEFR_LEVELS.length - 1) {
          const nextLevel = CEFR_LEVELS[currentLevelIndex + 1];
          if (nextLevel) {
            current_cefr_level = nextLevel;
            correct_streak = 0;
            leveledUp = true;
          }
        } else {
          // If already at max level, reset streak
          correct_streak = 0;
        }
      }
    } else {
      correct_streak = 0;
    }

    db.prepare(
      'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
    ).run(current_cefr_level, correct_streak, userId, normalizedLanguage);

    return {
      currentLevel: current_cefr_level,
      currentStreak: correct_streak,
      leveledUp: leveledUp,
    };
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(
      `[calculateAndUpdateProgress] DB Error for user ${userId}, lang ${normalizedLanguage}: ${message}`
    );
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      leveledUp: false,
      error: `A database error occurred during progress update.`,
    };
  }
};
