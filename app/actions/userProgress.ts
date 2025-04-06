'use server';

import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import db from '@/lib/db';
import { z } from 'zod';

// Define an interface for the session user that includes dbId
interface SessionUser extends NonNullable<Session['user']> {
  dbId?: number;
}

const CEFR_LEVELS: ReadonlyArray<string> = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Schemas for request validation
const updateProgressSchema = z.object({
  isCorrect: z.boolean(),
  language: z.string().min(2).max(5), // Expecting language code e.g., 'en', 'es'
});

const getProgressSchema = z.object({
  language: z.string().min(2).max(5),
});

export type UpdateProgressParams = z.infer<typeof updateProgressSchema>;
export type GetProgressParams = z.infer<typeof getProgressSchema>;

export interface ProgressResponse {
  currentLevel: string;
  currentStreak: number;
  leveledUp?: boolean;
  error?: string;
}

// Update progress - equivalent to POST handler
export const updateProgress = async (params: UpdateProgressParams): Promise<ProgressResponse> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    console.warn('[UserProgress] Unauthorized access attempt or missing dbId');
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'Unauthorized or invalid session',
    };
  }

  const userId = sessionUser.dbId;

  try {
    console.log('[UserProgress] Request params:', JSON.stringify(params));

    // Now parse/validate the params
    const parsedBody = updateProgressSchema.safeParse(params);

    if (!parsedBody.success) {
      console.warn(
        `[UserProgress] Invalid request body for user ${userId}:`,
        parsedBody.error.flatten()
      );
      return {
        currentLevel: 'A1',
        currentStreak: 0,
        error: 'Invalid request parameters',
      };
    }

    const { isCorrect, language } = parsedBody.data;

    // Safety check for language code
    if (!language) {
      console.warn(`[UserProgress] Missing language parameter for user ${userId}`);
      return {
        currentLevel: 'A1',
        currentStreak: 0,
        error: 'Language parameter is required',
      };
    }

    // Normalize language code: ensure lowercase 2-letter code
    const normalizedLanguage = language.toLowerCase().slice(0, 2);
    console.log(`[UserProgress] Processing for user ${userId}, language: ${normalizedLanguage}`);

    // --- Get or Create User Progress Record for the language ---
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
        console.log(
          `[UserProgress] No record found for user ${userId}, language ${normalizedLanguage}. Creating default A1 record.`
        );
        // Create default record if none exists for this language
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

      // --- Calculate New Progress ---
      let leveledUp = false;

      if (isCorrect) {
        correct_streak += 1;
        if (correct_streak >= 5) {
          const currentLevelIndex = CEFR_LEVELS.indexOf(current_cefr_level);
          if (currentLevelIndex < CEFR_LEVELS.length - 1) {
            current_cefr_level = CEFR_LEVELS[currentLevelIndex + 1];
            correct_streak = 0; // Reset streak on level up
            leveledUp = true;
            console.log(
              `[UserProgress] User ${userId}, Lang ${normalizedLanguage}: Leveled up to ${current_cefr_level}`
            );
          } else {
            correct_streak = 0; // Reset streak even at max level
            console.log(
              `[UserProgress] User ${userId}, Lang ${normalizedLanguage}: Reached max level, streak reset.`
            );
          }
        }
      } else {
        if (correct_streak > 0) {
          console.log(
            `[UserProgress] User ${userId}, Lang ${normalizedLanguage}: Streak reset from ${correct_streak}.`
          );
        }
        correct_streak = 0;
      }

      // --- Update Progress in DB ---
      db.prepare(
        'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
      ).run(current_cefr_level, correct_streak, userId, normalizedLanguage);

      console.log(
        `[UserProgress] Successfully updated progress for user ${userId}, language ${normalizedLanguage}`
      );
      return {
        currentLevel: current_cefr_level,
        currentStreak: correct_streak,
        leveledUp: leveledUp,
      };
    } catch (dbError) {
      console.error(`[UserProgress] Database error for user ${userId}:`, dbError);
      return {
        currentLevel: 'A1',
        currentStreak: 0,
        error: 'A database error occurred while updating progress',
      };
    }
  } catch (error) {
    console.error(`[UserProgress] Error for user ${userId}:`, error);
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'An error occurred while updating progress',
    };
  }
};

// Get progress - equivalent to GET handler
export const getProgress = async (params: GetProgressParams): Promise<ProgressResponse> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    console.warn('[UserProgress] Unauthorized access attempt or missing dbId');
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'Unauthorized or invalid session',
    };
  }

  const userId = sessionUser.dbId;

  console.log(`[UserProgress] Request for user ${userId}, raw language: ${params.language}`);

  if (!params.language) {
    console.warn(`[UserProgress] Missing language parameter for user ${userId}`);
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'Language parameter is required',
    };
  }

  const parsedQuery = getProgressSchema.safeParse(params);

  if (!parsedQuery.success) {
    console.warn(
      `[UserProgress] Invalid language parameter for user ${userId}:`,
      parsedQuery.error.flatten()
    );
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'Invalid language parameter',
    };
  }

  // Normalize language code: ensure lowercase 2-letter code
  const normalizedLanguage = parsedQuery.data.language.toLowerCase().slice(0, 2);
  console.log(
    `[UserProgress] Processing for user ${userId}, normalized language: ${normalizedLanguage}`
  );

  try {
    // Fetch progress for the specific user and language
    const userProgress = db
      .prepare(
        'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, normalizedLanguage) as
      | { cefr_level: string; correct_streak: number }
      | undefined;

    if (!userProgress) {
      // If no record, assume A1 level, 0 streak (as per new logic)
      console.log(
        `[UserProgress] No record found for user ${userId}, language ${normalizedLanguage}. Returning default A1.`
      );
      return { currentLevel: 'A1', currentStreak: 0 };
    }

    console.log(
      `[UserProgress] Found progress for user ${userId}, language ${normalizedLanguage}:`,
      userProgress
    );
    return {
      currentLevel: userProgress.cefr_level,
      currentStreak: userProgress.correct_streak,
    };
  } catch (error) {
    console.error(
      `[UserProgress] Error for user ${userId}, language ${normalizedLanguage}:`,
      error
    );
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'An error occurred while fetching progress',
    };
  }
};
