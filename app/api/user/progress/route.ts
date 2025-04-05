import { NextResponse } from 'next/server';
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
const postRequestBodySchema = z.object({
  isCorrect: z.boolean(),
  language: z.string().min(2).max(5), // Expecting language code e.g., 'en', 'es'
});

const getRequestQuerySchema = z.object({
  language: z.string().min(2).max(5),
});

// --- POST Handler --- (Update progress)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    console.warn('[API /user/progress POST] Unauthorized access attempt or missing dbId');
    return NextResponse.json({ error: 'Unauthorized or invalid session' }, { status: 401 });
  }

  const userId = sessionUser.dbId;

  try {
    const rawBody: unknown = await request.json();
    console.log('[API /user/progress POST] Request body:', JSON.stringify(rawBody));

    // Now parse/validate the unknown type
    const parsedBody = postRequestBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      console.warn(
        `[API /user/progress POST] Invalid request body for user ${userId}:`,
        parsedBody.error.flatten()
      );
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const { isCorrect, language } = parsedBody.data;

    // Safety check for language code
    if (!language) {
      console.warn(`[API /user/progress POST] Missing language parameter for user ${userId}`);
      return NextResponse.json({ error: 'Language parameter is required' }, { status: 400 });
    }

    // Normalize language code: ensure lowercase 2-letter code
    const normalizedLanguage = language.toLowerCase().slice(0, 2);
    console.log(
      `[API /user/progress POST] Processing for user ${userId}, language: ${normalizedLanguage}`
    );

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
          `[API /user/progress POST] No record found for user ${userId}, language ${normalizedLanguage}. Creating default A1 record.`
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
              `[API /user/progress POST] User ${userId}, Lang ${normalizedLanguage}: Leveled up to ${current_cefr_level}`
            );
          } else {
            correct_streak = 0; // Reset streak even at max level
            console.log(
              `[API /user/progress POST] User ${userId}, Lang ${normalizedLanguage}: Reached max level, streak reset.`
            );
          }
        }
      } else {
        if (correct_streak > 0) {
          console.log(
            `[API /user/progress POST] User ${userId}, Lang ${normalizedLanguage}: Streak reset from ${correct_streak}.`
          );
        }
        correct_streak = 0;
      }

      // --- Update Progress in DB ---
      db.prepare(
        'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
      ).run(current_cefr_level, correct_streak, userId, normalizedLanguage);

      console.log(
        `[API /user/progress POST] Successfully updated progress for user ${userId}, language ${normalizedLanguage}`
      );
      return NextResponse.json({
        currentLevel: current_cefr_level,
        currentStreak: correct_streak,
        leveledUp: leveledUp,
      });
    } catch (dbError) {
      console.error(`[API /user/progress POST] Database error for user ${userId}:`, dbError);
      return NextResponse.json(
        { error: 'A database error occurred while updating progress' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`[API /user/progress POST] Error for user ${userId}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while updating progress' },
      { status: 500 }
    );
  }
}

// --- GET Handler --- (Fetch progress for a specific language)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    console.warn('[API /user/progress GET] Unauthorized access attempt or missing dbId');
    return NextResponse.json({ error: 'Unauthorized or invalid session' }, { status: 401 });
  }

  const userId = sessionUser.dbId;

  // Extract language from query parameters
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language');
  console.log(`[API /user/progress GET] Request for user ${userId}, raw language: ${language}`);

  if (!language) {
    console.warn(`[API /user/progress GET] Missing language parameter for user ${userId}`);
    return NextResponse.json({ error: 'Language parameter is required' }, { status: 400 });
  }

  const parsedQuery = getRequestQuerySchema.safeParse({ language });

  if (!parsedQuery.success) {
    console.warn(
      `[API /user/progress GET] Invalid language parameter for user ${userId}:`,
      parsedQuery.error.flatten()
    );
    return NextResponse.json(
      { error: 'Invalid query parameter: language', issues: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  // Normalize language code: ensure lowercase 2-letter code
  const normalizedLanguage = parsedQuery.data.language.toLowerCase().slice(0, 2);
  console.log(
    `[API /user/progress GET] Processing for user ${userId}, normalized language: ${normalizedLanguage}`
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
      // We could optionally create the record here too, but GET shouldn't usually modify data.
      // Let POST handle creation on first correct/incorrect answer for the language.
      console.log(
        `[API /user/progress GET] No record found for user ${userId}, language ${normalizedLanguage}. Returning default A1.`
      );
      return NextResponse.json({ currentLevel: 'A1', currentStreak: 0 });
    }

    console.log(
      `[API /user/progress GET] Found progress for user ${userId}, language ${normalizedLanguage}:`,
      userProgress
    );
    return NextResponse.json({
      currentLevel: userProgress.cefr_level,
      currentStreak: userProgress.correct_streak,
    });
  } catch (error) {
    console.error(
      `[API /user/progress GET] Error for user ${userId}, language ${normalizedLanguage}:`,
      error
    );
    return NextResponse.json(
      { error: 'An error occurred while fetching progress' },
      { status: 500 }
    );
  }
}
