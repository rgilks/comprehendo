import { and, eq } from 'drizzle-orm';
import db from '@/lib/db';
import { userLanguageProgress } from '@/lib/db/schema';
import { Progress, ProgressSchema } from '@/lib/domain/progress';
import { CEFRLevel } from '@/lib/domain/language-guidance';

export const STREAK_THRESHOLD_FOR_LEVEL_UP = 5;

export const getProgress = async (
  userId: number,
  languageCode: string
): Promise<Progress | null> => {
  try {
    const result = await db
      .select()
      .from(userLanguageProgress)
      .where(
        and(
          eq(userLanguageProgress.userId, userId),
          eq(userLanguageProgress.languageCode, languageCode)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const rawProgress = result[0];
    const parseResult = ProgressSchema.safeParse({
      ...rawProgress,
      last_practiced: rawProgress.lastPracticed ? new Date(rawProgress.lastPracticed) : null,
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
  const initialProgressData = {
    userId,
    languageCode,
    cefrLevel: 'A1' as CEFRLevel,
    correctStreak: 0,
    lastPracticed: null,
  };

  try {
    await db.insert(userLanguageProgress).values(initialProgressData);

    return {
      user_id: userId,
      language_code: languageCode,
      cefr_level: 'A1',
      correct_streak: 0,
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
    const result = await db
      .update(userLanguageProgress)
      .set({
        cefrLevel: newLevel,
        correctStreak: newStreak,
        lastPracticed: new Date(),
      })
      .where(
        and(
          eq(userLanguageProgress.userId, userId),
          eq(userLanguageProgress.languageCode, languageCode)
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
