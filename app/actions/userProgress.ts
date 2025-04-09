'use server';

import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import db from '@/lib/db';
import { z } from 'zod';
import { staticA1Exercises, type GeneratedContentRow } from '../config/static-exercises';

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

// Schema for quiz data stored in the DB
const dbQuizDataSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  explanations: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctAnswer: z.string(),
  relevantText: z.string(),
  topic: z.string(),
});

// Updated schema for the submitAnswer action
const submitAnswerSchema = z.object({
  selectedAnswer: z.string().length(1),
  language: z.string().min(2).max(5),
  quizId: z.number().int().positive(),
});

export type UpdateProgressParams = z.infer<typeof updateProgressSchema>;
export type GetProgressParams = z.infer<typeof getProgressSchema>;

// --- UPDATED ProgressResponse to include feedback --- START
export interface ProgressResponse {
  currentLevel: string;
  currentStreak: number;
  leveledUp?: boolean;
  error?: string;
  feedback?: {
    isCorrect: boolean;
    correctAnswer: string;
    explanations: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    relevantText: string;
  };
}
// --- UPDATED ProgressResponse to include feedback --- END

// --- Internal helper function for progress logic --- START
// Extracted from original updateProgress to be reusable
function calculateAndUpdateProgress(
  userId: number,
  language: string,
  isCorrect: boolean
): { currentLevel: string; currentStreak: number; leveledUp: boolean; dbError?: string } {
  const normalizedLanguage = language.toLowerCase().slice(0, 2);
  console.log(`[ProgressCalc] Calculating for user ${userId}, language: ${normalizedLanguage}`);

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
        `[ProgressCalc] No record found for user ${userId}, language ${normalizedLanguage}. Creating default A1 record.`
      );
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
        if (currentLevelIndex < CEFR_LEVELS.length - 1) {
          current_cefr_level = CEFR_LEVELS[currentLevelIndex + 1];
          correct_streak = 0;
          leveledUp = true;
          console.log(
            `[ProgressCalc] User ${userId}, Lang ${normalizedLanguage}: Leveled up to ${current_cefr_level}`
          );
        } else {
          correct_streak = 0;
          console.log(
            `[ProgressCalc] User ${userId}, Lang ${normalizedLanguage}: Reached max level, streak reset.`
          );
        }
      }
    } else {
      if (correct_streak > 0) {
        console.log(
          `[ProgressCalc] User ${userId}, Lang ${normalizedLanguage}: Streak reset from ${correct_streak}.`
        );
      }
      correct_streak = 0;
    }

    db.prepare(
      'UPDATE user_language_progress SET cefr_level = ?, correct_streak = ?, last_practiced = CURRENT_TIMESTAMP WHERE user_id = ? AND language_code = ?'
    ).run(current_cefr_level, correct_streak, userId, normalizedLanguage);

    console.log(
      `[ProgressCalc] Updated progress for user ${userId}, language ${normalizedLanguage}. New Level: ${current_cefr_level}, Streak: ${correct_streak}`
    );
    return {
      currentLevel: current_cefr_level,
      currentStreak: correct_streak,
      leveledUp: leveledUp,
    };
  } catch (dbError) {
    console.error(`[ProgressCalc] Database error for user ${userId}:`, dbError);
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      leveledUp: false,
      dbError: `A database error occurred: ${message}`,
    };
  }
}
// --- Internal helper function for progress logic --- END

// Update progress - (KEEPING for potential internal use? Or remove if unused)
// This version doesn't return feedback, only progress.
export const updateProgress = async (params: UpdateProgressParams): Promise<ProgressResponse> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    return { currentLevel: 'A1', currentStreak: 0, error: 'Unauthorized' };
  }

  const userId = sessionUser.dbId;
  const parsedBody = updateProgressSchema.safeParse(params);

  if (!parsedBody.success) {
    return { currentLevel: 'A1', currentStreak: 0, error: 'Invalid parameters' };
  }

  const { isCorrect, language } = parsedBody.data;

  // Call the internal logic function
  const progressResult = calculateAndUpdateProgress(userId, language, isCorrect);

  // Return the result, including any DB error message
  return {
    currentLevel: progressResult.currentLevel,
    currentStreak: progressResult.currentStreak,
    leveledUp: progressResult.leveledUp,
    error: progressResult.dbError, // Pass potential DB error back
  };
};

// --- REVISED ACTION: submitAnswer ---
export const submitAnswer = async (
  params: z.infer<typeof submitAnswerSchema>
): Promise<ProgressResponse> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;
  const userId = sessionUser?.dbId;

  console.log(`[SubmitAnswer] Request received. UserID: ${userId ?? 'Anonymous'}`);

  // Input Validation
  const parsedBody = submitAnswerSchema.safeParse(params);
  if (!parsedBody.success) {
    const errorDetails = JSON.stringify(parsedBody.error.flatten().fieldErrors);
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: `Invalid request parameters: ${errorDetails}`,
    };
  }

  const { selectedAnswer, language, quizId } = parsedBody.data;

  // Fetch Full Quiz Data (Handle Static IDs first)
  let fullQuizData: z.infer<typeof dbQuizDataSchema>;
  try {
    // Check for Static A1 Exercises
    const staticExercise: GeneratedContentRow | undefined = staticA1Exercises.find(
      (ex) => ex.id === quizId
    );
    if (staticExercise) {
      console.log(`[SubmitAnswer] Found static exercise for ID ${quizId}`);
      const parsedContent: unknown = JSON.parse(staticExercise.content);
      fullQuizData = dbQuizDataSchema.parse(parsedContent); // Validate static data
    } else {
      // --- If not static, fetch from DB ---
      console.log(`[SubmitAnswer] ID ${quizId} not static, fetching from DB.`);
      const cachedRow = db
        .prepare('SELECT content FROM generated_content WHERE id = ?')
        .get(quizId) as { content: string } | undefined;

      if (!cachedRow?.content) {
        return {
          currentLevel: 'A1',
          currentStreak: 0,
          error: 'Quiz data not found for the provided ID.',
        };
      }

      const parsedContent: unknown = JSON.parse(cachedRow.content);
      fullQuizData = dbQuizDataSchema.parse(parsedContent);
    } // --- End DB fetch block ---
  } catch (dataError: unknown) {
    // Handle errors during static data parsing OR DB fetching/parsing
    let message: string;
    if (dataError instanceof z.ZodError) {
      message = `Invalid quiz data structure: ${JSON.stringify(dataError.flatten().fieldErrors)}`;
    } else if (dataError instanceof SyntaxError) {
      message = 'Invalid JSON format for quiz data';
    } else if (dataError instanceof Error) {
      message = dataError.message;
    } else {
      message = 'Unknown error fetching/parsing quiz data';
    }
    console.error(`[SubmitAnswer] Data fetch/parse error for quiz ID ${quizId}:`, message);
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: `Error retrieving quiz details: ${message}`,
    };
  }

  // Determine Correctness
  const isCorrect = selectedAnswer === fullQuizData.correctAnswer;

  // Update Progress ONLY IF USER IS LOGGED IN
  let progressResult: {
    currentLevel: string;
    currentStreak: number;
    leveledUp: boolean;
    dbError?: string;
  };
  if (userId) {
    progressResult = calculateAndUpdateProgress(userId, language, isCorrect);
  } else {
    progressResult = { currentLevel: 'A1', currentStreak: 0, leveledUp: false };
  }

  // Construct Feedback
  const feedbackData = {
    isCorrect: isCorrect,
    correctAnswer: fullQuizData.correctAnswer,
    explanations: fullQuizData.explanations,
    relevantText: fullQuizData.relevantText,
  };

  // Return combined progress and feedback
  return {
    currentLevel: progressResult.currentLevel,
    currentStreak: progressResult.currentStreak,
    leveledUp: progressResult.leveledUp,
    error: progressResult.dbError,
    feedback: feedbackData,
  };
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
