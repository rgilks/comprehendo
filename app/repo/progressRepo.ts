import { eq, and } from 'drizzle-orm';
import { Progress, ProgressSchema } from 'app/domain/progress';
import { CEFRLevel } from 'app/domain/language-guidance';
import getDb, { schema } from 'app/lib/db';

const STREAK_THRESHOLD_FOR_LEVEL_UP = 5;

export const getProgress = async (
  userId: number,
  languageCode: string
): Promise<Progress | null> => {
  try {
    const db = getDb();

    const result = await db
      .select()
      .from(schema.userLanguageProgress)
      .where(
        and(
          eq(schema.userLanguageProgress.userId, userId),
          eq(schema.userLanguageProgress.languageCode, languageCode)
        )
      )
      .limit(1);

    if (result.length === 0) return null;

    const row = result[0];
    const parseResult = ProgressSchema.safeParse({
      user_id: row.userId,
      language_code: row.languageCode,
      cefr_level: row.cefrLevel,
      correct_streak: row.correctStreak,
      last_practiced: row.lastPracticed ? new Date(row.lastPracticed) : null,
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

export const initializeProgress = async (
  userId: number,
  languageCode: string
): Promise<Progress> => {
  const initialProgress: Omit<Progress, 'user_id' | 'language_code' | 'last_practiced'> = {
    cefr_level: 'A1',
    correct_streak: 0,
  };

  try {
    const db = getDb();

    await db.insert(schema.userLanguageProgress).values({
      userId,
      languageCode,
      cefrLevel: initialProgress.cefr_level,
      correctStreak: initialProgress.correct_streak,
    });

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

export const updateProgress = async (
  userId: number,
  languageCode: string,
  newLevel: CEFRLevel,
  newStreak: number
): Promise<void> => {
  try {
    const db = getDb();

    const result = await db
      .update(schema.userLanguageProgress)
      .set({
        cefrLevel: newLevel,
        correctStreak: newStreak,
        lastPracticed: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.userLanguageProgress.userId, userId),
          eq(schema.userLanguageProgress.languageCode, languageCode)
        )
      );

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
