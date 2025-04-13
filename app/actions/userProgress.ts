'use server';

import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import db from '@/lib/db';
import { z } from 'zod';
import { QuizDataSchema, SubmitAnswerResultSchema } from '@/lib/domain/schemas';

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

// Updated schema for the submitAnswer action
const submitAnswerSchema = z.object({
  ans: z.string().length(1).optional(),
  learn: z.string().min(2).max(5),
  lang: z.string().min(2).max(5),
  id: z.number().int().positive().optional(),
  cefrLevel: z.string().optional(),
});

// Schema for question feedback input
const submitFeedbackSchema = z.object({
  quizId: z.number().int().positive(),
  rating: z.enum(['good', 'bad']), // Thumbs up/down represented as strings
});

export type UpdateProgressParams = z.infer<typeof updateProgressSchema>;
export type GetProgressParams = z.infer<typeof getProgressSchema>;
export type SubmitFeedbackParams = z.infer<typeof submitFeedbackSchema>;

// Infer the feedback type from the centralized schema
type FeedbackType = z.infer<typeof SubmitAnswerResultSchema>['feedback'];

// --- UPDATED ProgressResponse --- START
export interface ProgressResponse {
  currentLevel: string;
  currentStreak: number;
  leveledUp?: boolean;
  error?: string; // Error related to processing the current answer/progress
  feedback?: FeedbackType;
  // Removed nextQuiz field
}
// --- UPDATED ProgressResponse --- END

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

  console.log(`[SubmitAnswer] Request received. UserID: ${userId ?? 'Anonymous'}, Params:`, params);

  // Input Validation
  const parsedBody = submitAnswerSchema.safeParse(params);
  if (!parsedBody.success) {
    const errorDetails = JSON.stringify(parsedBody.error.flatten().fieldErrors);
    return {
      currentLevel: 'A1', // Default level
      currentStreak: 0, // Default streak
      error: `Invalid request parameters: ${errorDetails}`,
    };
  }

  const { ans, id, learn, cefrLevel: requestCefrLevel } = parsedBody.data;

  // Ensure we have a quiz ID to check against
  if (typeof id !== 'number') {
    return {
      currentLevel: 'A1',
      currentStreak: 0,
      error: 'Missing or invalid quiz ID in request.',
    };
  }

  let isCorrect = false;
  let feedbackData: FeedbackType = undefined;

  try {
    // --- Fetch Quiz Details ---
    const quizRecord = db.prepare('SELECT content FROM generated_content WHERE id = ?').get(id) as
      | { content: string }
      | undefined;

    if (!quizRecord) {
      return {
        currentLevel: 'A1',
        currentStreak: 0,
        error: `Quiz with ID ${id} not found.`,
      };
    }

    // --- Parse Content and Extract Data ---
    const parsedContent = QuizDataSchema.safeParse(JSON.parse(quizRecord.content));

    if (!parsedContent.success) {
      console.error(
        `[SubmitAnswer] Failed to parse quiz content (ID: ${id}) using QuizDataSchema: ${JSON.stringify(parsedContent.error.flatten())}`
      );
      return {
        currentLevel: 'A1',
        currentStreak: 0,
        error: `Failed to parse content for quiz ID ${id}.`,
      };
    }

    const fullQuizData = parsedContent.data;

    // --- Check Answer ---
    if (typeof ans === 'string' && ans in fullQuizData.options) {
      isCorrect = ans === fullQuizData.correctAnswer;
      console.log(
        `[SubmitAnswer] Answer check. User Ans: ${ans}, Correct Ans: ${fullQuizData.correctAnswer}, Result: ${isCorrect}`
      );

      // Construct feedback object ONLY if all required fields exist
      if (
        typeof fullQuizData.correctAnswer === 'string' &&
        fullQuizData.explanations && // Check if explanations object exists
        typeof fullQuizData.relevantText === 'string'
      ) {
        feedbackData = {
          isCorrect: isCorrect,
          correctAnswer: fullQuizData.correctAnswer,
          explanations: fullQuizData.explanations,
          relevantText: fullQuizData.relevantText,
        };
      } else {
        console.warn(
          `[SubmitAnswer] Cannot construct full feedback for Quiz ID ${id} due to missing data (correctAnswer, explanations, or relevantText).`
        );
        // Optionally create partial feedback or set feedbackData to undefined/null
        feedbackData = undefined; // Or handle as needed
      }
    } else {
      // Handle cases where answer is missing or invalid
      console.warn(`[SubmitAnswer] Invalid or missing answer provided: ${ans}`);
      // Optionally set an error or default feedback
      feedbackData = undefined;
    }
  } catch (error: unknown) {
    console.error(`[SubmitAnswer] Error fetching/processing quiz ${id}:`, error);
    return {
      currentLevel: 'A1', // Default level
      currentStreak: 0, // Default streak
      error: `Error processing answer for quiz ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  // Initialize response object structure
  const responsePayload: ProgressResponse = {
    currentLevel: 'A1', // Will be updated based on user progress or fetch
    currentStreak: 0,
    leveledUp: false,
    feedback: feedbackData, // Add the populated feedback data
  };

  if (userId) {
    try {
      const progressUpdate = calculateAndUpdateProgress(userId, learn, isCorrect);

      responsePayload.currentLevel = progressUpdate.currentLevel;
      responsePayload.currentStreak = progressUpdate.currentStreak;
      responsePayload.leveledUp = progressUpdate.leveledUp;
      if (progressUpdate.dbError) {
        // Log DB error but don't necessarily block feedback/response
        console.error(
          `[SubmitAnswer] DB Error during progress update for user ${userId}: ${progressUpdate.dbError}`
        );
        // Optionally add to responsePayload.error if needed
        // responsePayload.error = (responsePayload.error ? responsePayload.error + '; ' : '') + progressUpdate.dbError;
      }
    } catch (dbError) {
      // Catch errors specifically from the progress update block
      console.error(
        `[SubmitAnswer] Database error during progress update for user ${userId}:`,
        dbError
      );
      // Set an error in the response? Or just rely on the logged error?
      responsePayload.error =
        (responsePayload.error ? responsePayload.error + '; ' : '') +
        'Failed to update user progress.';
    }
  } else {
    // User is not logged in, determine level from request or default
    responsePayload.currentLevel = requestCefrLevel || 'A1';
    responsePayload.currentStreak = 0; // No streak for anonymous users
    responsePayload.leveledUp = false;
  }

  console.log('[SubmitAnswer] Sending Response Payload:', responsePayload);
  return responsePayload;
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

// --- NEW ACTION: submitQuestionFeedback --- START

// Response type for feedback submission
export interface SubmitFeedbackResponse {
  success: boolean;
  error?: string;
}

export const submitQuestionFeedback = async (
  params: SubmitFeedbackParams
): Promise<SubmitFeedbackResponse> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;
  const userId = sessionUser?.dbId;

  console.log(
    `[SubmitFeedback] Request received. UserID: ${userId ?? 'Anonymous'}, Params:`,
    params
  );

  // Only logged-in users can submit feedback for now
  if (!userId) {
    return { success: false, error: 'Unauthorized. User must be logged in to submit feedback.' };
  }

  // Input Validation
  const parsedBody = submitFeedbackSchema.safeParse(params);
  if (!parsedBody.success) {
    const errorDetails = JSON.stringify(parsedBody.error.flatten().fieldErrors);
    console.error(`[SubmitFeedback] Invalid request parameters: ${errorDetails}`);
    return { success: false, error: `Invalid request parameters: ${errorDetails}` };
  }

  const { quizId, rating } = parsedBody.data;

  try {
    // Check if the generated_content entry exists (optional but good practice)
    const quizExists = db.prepare('SELECT id FROM generated_content WHERE id = ?').get(quizId);
    if (!quizExists) {
      console.warn(
        `[SubmitFeedback] Attempt to submit feedback for non-existent quiz ID: ${quizId}`
      );
      return { success: false, error: `Quiz with ID ${quizId} not found.` };
    }

    // Insert feedback into the (assumed) question_feedback table
    // NOTE: This assumes a table named 'question_feedback' exists with columns:
    // quiz_id (INTEGER, FK to generated_content.id), user_id (INTEGER, FK to users.id), rating (TEXT), submitted_at (DATETIME)
    db.prepare('INSERT INTO question_feedback (quiz_id, user_id, rating) VALUES (?, ?, ?)').run(
      quizId,
      userId,
      rating
    );

    console.log(
      `[SubmitFeedback] Feedback recorded for Quiz ID ${quizId}, User ID ${userId}, Rating: ${rating}`
    );
    return { success: true };
  } catch (error: unknown) {
    console.error(
      `[SubmitFeedback] Error recording feedback for Quiz ID ${quizId}, User ID ${userId}:`,
      error
    );
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return { success: false, error: `Failed to record feedback: ${message}` };
  }
};

// --- NEW ACTION: submitQuestionFeedback --- END
