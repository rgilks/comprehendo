import db from 'app/repo/db';
import { Progress, ProgressSchema } from 'app/domain/progress';
import { CEFRLevel } from 'app/domain/language-guidance';

type RawProgress = {
  user_id: number;
  language_code: string;
  cefr_level: CEFRLevel;
  correct_streak: number;
  last_practiced: string | null;
};

const STREAK_THRESHOLD_FOR_LEVEL_UP = 5;

export const getProgress = (userId: number, languageCode: string): Progress | null => {
  try {
    const row = db
      .prepare(
        'SELECT user_id, language_code, cefr_level, correct_streak, last_practiced FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, languageCode) as RawProgress | undefined;
    if (!row) return null;
    const parseResult = ProgressSchema.safeParse({
      ...row,
      last_practiced: row.last_practiced ? new Date(row.last_practiced) : null,
    });
    if (!parseResult.success) {
      console.error(
        `[getProgress] Failed to parse progress for user ${userId}, lang ${languageCode}:`,
        parseResult.error.issues
      );
      return null;
    }
    return parseResult.data;
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(`[getProgress] DB Error for user ${userId}, lang ${languageCode}: ${message}`);
    throw new Error(`Database error fetching progress for user ${userId}, lang ${languageCode}.`);
  }
};

export const initializeProgress = (userId: number, languageCode: string): Progress => {
  const initialProgress: Omit<Progress, 'user_id' | 'language_code' | 'last_practiced'> = {
    cefr_level: 'A1',
    correct_streak: 0,
  };

  try {
    db.prepare(
      'INSERT INTO user_language_progress (user_id, language_code, cefr_level, correct_streak) VALUES (?, ?, ?, ?)'
    ).run(userId, languageCode, initialProgress.cefr_level, initialProgress.correct_streak);

    return {
      ...initialProgress,
      user_id: userId,
      language_code: languageCode,
      last_practiced: null,
    };
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(
      `[initializeProgress] DB Error for user ${userId}, lang ${languageCode}: ${message}`
    );
    throw new Error(
      `Database error initializing progress for user ${userId}, lang ${languageCode}.`
    );
  }
};

export const updateProgress = (
  userId: number,
  languageCode: string,
  newLevel: CEFRLevel,
  newStreak: number
): void => {
  try {
    const result = db
      .prepare(
        'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
      )
      .run(newLevel, newStreak, userId, languageCode);

    if (result.changes === 0) {
      console.warn(
        `[updateProgress] No rows updated for user ${userId}, lang ${languageCode}. Progress might not have been initialized.`
      );
    }
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(`[updateProgress] DB Error for user ${userId}, lang ${languageCode}: ${message}`);
    throw new Error(`Database error updating progress for user ${userId}, lang ${languageCode}.`);
  }
};

export { STREAK_THRESHOLD_FOR_LEVEL_UP };
