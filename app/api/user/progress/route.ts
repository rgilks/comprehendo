import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth/next';
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
    const body = await request.json();
    const parsedBody = postRequestBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsedBody.error.flatten() },
        { status: 400 }
      );
    }

    const { isCorrect, language } = parsedBody.data;

    // --- Get or Create User Progress Record for the language ---
    let userProgress = db
      .prepare(
        'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, language) as { cefr_level: string; correct_streak: number } | undefined;

    let current_cefr_level: string;
    let correct_streak: number;

    if (!userProgress) {
      console.log(
        `[API /user/progress POST] No record found for user ${userId}, language ${language}. Creating default A1 record.`
      );
      // Create default record if none exists for this language
      db.prepare('INSERT INTO user_language_progress (user_id, language_code) VALUES (?, ?)').run(
        userId,
        language
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
            `[API /user/progress POST] User ${userId}, Lang ${language}: Leveled up to ${current_cefr_level}`
          );
        } else {
          correct_streak = 0; // Reset streak even at max level
          console.log(
            `[API /user/progress POST] User ${userId}, Lang ${language}: Reached max level, streak reset.`
          );
        }
      }
    } else {
      if (correct_streak > 0) {
        console.log(
          `[API /user/progress POST] User ${userId}, Lang ${language}: Streak reset from ${correct_streak}.`
        );
      }
      correct_streak = 0;
    }

    // --- Update Progress in DB ---
    db.prepare(
      'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
    ).run(current_cefr_level, correct_streak, userId, language);

    return NextResponse.json({
      currentLevel: current_cefr_level,
      currentStreak: correct_streak,
      leveledUp: leveledUp,
    });
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

  const parsedQuery = getRequestQuerySchema.safeParse({ language });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'Invalid query parameter: language', issues: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  const validatedLanguage = parsedQuery.data.language;

  try {
    // Fetch progress for the specific user and language
    let userProgress = db
      .prepare(
        'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, validatedLanguage) as { cefr_level: string; correct_streak: number } | undefined;

    if (!userProgress) {
      // If no record, assume A1 level, 0 streak (as per new logic)
      // We could optionally create the record here too, but GET shouldn't usually modify data.
      // Let POST handle creation on first correct/incorrect answer for the language.
      console.log(
        `[API /user/progress GET] No record found for user ${userId}, language ${validatedLanguage}. Returning default A1.`
      );
      return NextResponse.json({ currentLevel: 'A1', currentStreak: 0 });
    }

    return NextResponse.json({
      currentLevel: userProgress.cefr_level,
      currentStreak: userProgress.correct_streak,
    });
  } catch (error) {
    console.error(
      `[API /user/progress GET] Error for user ${userId}, language ${validatedLanguage}:`,
      error
    );
    return NextResponse.json(
      { error: 'An error occurred while fetching progress' },
      { status: 500 }
    );
  }
}
