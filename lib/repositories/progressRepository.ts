import db from '@/lib/db';
import { Progress, ProgressSchema } from '@/lib/domain/progress';
import { CEFRLevel } from '@/lib/domain/language-guidance';

// Define the expected raw shape returned by the DB query
// Note: last_practiced might be string (ISO 8601) or null from DB
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

    if (!row) {
      return null;
    }

    // Validate and potentially transform the raw DB data
    const parseResult = ProgressSchema.safeParse({
      ...row,
      // Assuming last_practiced is stored as TEXT (ISO 8601) which Zod parses to Date
      // If stored differently (e.g., unix timestamp), adjust parsing here
      last_practiced: row.last_practiced ? new Date(row.last_practiced) : null,
    });

    if (!parseResult.success) {
      console.error(
        `[getProgress] Failed to parse progress for user ${userId}, lang ${languageCode}:`,
        parseResult.error.issues
      );
      // Decide on error handling: return null, throw, or return a default?
      // Returning null seems reasonable if data is invalid.
      return null;
    }

    return parseResult.data;
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(`[getProgress] DB Error for user ${userId}, lang ${languageCode}: ${message}`);
    // Propagate the error or return null/default?
    // Throwing might be better here to signal a DB issue upstream.
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
      last_practiced: null, // Initial state has no last practiced date
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
      // This might happen if the record didn't exist, although getProgress should handle creation
      console.warn(
        `[updateProgress] No rows updated for user ${userId}, lang ${languageCode}. Progress might not have been initialized.`
      );
      // Optionally, try to initialize here, or rely on the calling logic to handle this
    }
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(`[updateProgress] DB Error for user ${userId}, lang ${languageCode}: ${message}`);
    throw new Error(`Database error updating progress for user ${userId}, lang ${languageCode}.`);
  }
};

// Constant for streak threshold
export { STREAK_THRESHOLD_FOR_LEVEL_UP };
