'use server';

import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import db from '@/lib/db';
import { z } from 'zod';
import { staticA1Exercises, type GeneratedContentRow } from '../config/static-exercises';
import { generateExerciseResponse, type PartialQuizData } from '@/app/actions/exercise';

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
  ans: z.string().length(1).optional(),
  learn: z.string().min(2).max(5),
  lang: z.string().min(2).max(5),
  id: z.number().int().positive().optional(),
  cefrLevel: z.string().optional(),
});

export type UpdateProgressParams = z.infer<typeof updateProgressSchema>;
export type GetProgressParams = z.infer<typeof getProgressSchema>;

// --- UPDATED ProgressResponse to include feedback AND next quiz--- START
export interface ProgressResponse {
  currentLevel: string;
  currentStreak: number;
  leveledUp?: boolean;
  error?: string; // Error related to processing the current answer/progress
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
  // Add field for the next quiz data or generation error
  nextQuiz?: {
    quizData?: PartialQuizData;
    quizId?: number;
    error?: string; // Error specifically from generating the next quiz
  };
}
// --- UPDATED ProgressResponse to include feedback AND next quiz --- END

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

  const { ans, id, learn, lang, cefrLevel: requestCefrLevel } = parsedBody.data;

  // Initialize response object structure
  const responsePayload: ProgressResponse = {
    currentLevel: 'A1', // Will be updated based on user progress or fetch
    currentStreak: 0,
    leveledUp: false,
  };

  // Determine user's current CEFR level (needed for both paths)
  let cefrLevelForGeneration: string = requestCefrLevel || 'A1'; // Start with request or A1
  if (userId) {
    try {
      const userProgress = db
        .prepare(
          'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
        )
        .get(userId, learn.toLowerCase().slice(0, 2)) as
        | { cefr_level: string; correct_streak: number }
        | undefined;

      if (userProgress) {
        responsePayload.currentLevel = userProgress.cefr_level;
        responsePayload.currentStreak = userProgress.correct_streak;
        // If processing an answer, use this level for NEXT generation
        // If getting first quiz, use this level for CURRENT generation
        cefrLevelForGeneration = userProgress.cefr_level;
      } else {
        // No progress record, default to A1 for level and generation
        responsePayload.currentLevel = 'A1';
        responsePayload.currentStreak = 0;
        cefrLevelForGeneration = 'A1';
      }
    } catch (dbError) {
      console.error('[SubmitAnswer] Error fetching user progress:', dbError);
      // Proceed with A1 defaults, maybe add non-critical error to response?
      responsePayload.error = 'Failed to fetch user progress, using defaults.'; // Non-blocking error
      cefrLevelForGeneration = 'A1';
      responsePayload.currentLevel = 'A1';
      responsePayload.currentStreak = 0;
    }
  } else {
    // Anonymous user: Use requested level or A1 for generation, reflect that in response
    cefrLevelForGeneration = requestCefrLevel || 'A1';
    responsePayload.currentLevel = cefrLevelForGeneration;
    responsePayload.currentStreak = 0;
  }

  // --- PATH 1: Submitting an Answer (ans and id are provided) ---
  if (ans && id) {
    console.log(
      `[SubmitAnswer] Processing answer '${ans}' for quiz ID ${id}, learn=${learn}, lang=${lang}, level=${cefrLevelForGeneration}`
    );

    // 1. Fetch Full Quiz Data for the submitted answer
    let fullQuizData: z.infer<typeof dbQuizDataSchema>;
    try {
      const staticExercise: GeneratedContentRow | undefined = staticA1Exercises.find(
        (ex) => ex.id === id
      );
      if (staticExercise) {
        console.log(`[SubmitAnswer] Found static exercise for ID ${id}`);
        const parsedContent: unknown = JSON.parse(staticExercise.content);
        fullQuizData = dbQuizDataSchema.parse(parsedContent);
      } else {
        console.log(`[SubmitAnswer] ID ${id} not static, fetching from DB.`);
        const cachedRow = db
          .prepare('SELECT content FROM generated_content WHERE id = ?')
          .get(id) as { content: string } | undefined;
        if (!cachedRow?.content) {
          responsePayload.error = 'Quiz data not found for the provided ID.';
          return responsePayload; // Cannot proceed
        }
        const parsedContent: unknown = JSON.parse(cachedRow.content);
        fullQuizData = dbQuizDataSchema.parse(parsedContent);
      }
    } catch (dataError: unknown) {
      let message = 'Unknown error fetching/parsing quiz data';
      if (dataError instanceof z.ZodError) {
        message = `Invalid quiz data structure: ${JSON.stringify(dataError.flatten().fieldErrors)}`;
      } else if (dataError instanceof SyntaxError) {
        message = 'Invalid JSON format for quiz data';
      } else if (dataError instanceof Error) {
        message = dataError.message;
      }
      console.error(`[SubmitAnswer] Data fetch/parse error for quiz ID ${id}:`, message);
      responsePayload.error = `Error retrieving quiz details: ${message}`;
      return responsePayload; // Cannot proceed
    }

    // 2. Determine Correctness
    const isCorrect = ans === fullQuizData.correctAnswer;

    // 3. Update Progress (if logged in)
    if (userId) {
      const progressResult = calculateAndUpdateProgress(userId, learn, isCorrect);
      responsePayload.currentLevel = progressResult.currentLevel;
      responsePayload.currentStreak = progressResult.currentStreak;
      responsePayload.leveledUp = progressResult.leveledUp;
      // Overwrite initial fetch error if DB update succeeds/fails
      responsePayload.error = progressResult.dbError;
      // Use the *updated* level for generating the *next* quiz
      cefrLevelForGeneration = progressResult.currentLevel;
    } else {
      // For anonymous users, progress doesn't change, use initial level for next gen
      responsePayload.currentLevel = requestCefrLevel || 'A1';
      responsePayload.currentStreak = 0; // Streak doesn't apply
      cefrLevelForGeneration = responsePayload.currentLevel;
    }

    // 4. Construct Feedback for the *current* question
    responsePayload.feedback = {
      isCorrect: isCorrect,
      correctAnswer: fullQuizData.correctAnswer,
      explanations: fullQuizData.explanations,
      relevantText: fullQuizData.relevantText,
    };

    // 5. Generate the *next* exercise (using potentially updated level)
    try {
      console.log(
        `[SubmitAnswer] Generating *next* exercise: learn=${learn}, lang=${lang}, level=${cefrLevelForGeneration}`
      );
      const nextExerciseResult = await generateExerciseResponse({
        passageLanguage: learn,
        questionLanguage: lang,
        cefrLevel: cefrLevelForGeneration,
      });

      if (nextExerciseResult.error || !nextExerciseResult.quizId) {
        console.error('[SubmitAnswer] Failed to generate next exercise:', nextExerciseResult.error);
        responsePayload.nextQuiz = { error: nextExerciseResult.error || 'Generation failed' };
      } else {
        const nextQuizData = JSON.parse(nextExerciseResult.result) as PartialQuizData;
        responsePayload.nextQuiz = {
          quizData: nextQuizData,
          quizId: nextExerciseResult.quizId,
        };
      }
    } catch (generationError) {
      console.error('[SubmitAnswer] Error calling generateExerciseResponse:', generationError);
      const message =
        generationError instanceof Error ? generationError.message : 'Unknown generation error';
      responsePayload.nextQuiz = { error: `Failed to generate next exercise: ${message}` };
    }

    // --- PATH 2: Getting a New/First Quiz (ans and id are NOT provided) ---
  } else {
    console.log(
      `[SubmitAnswer] Generating *new/first* exercise: learn=${learn}, lang=${lang}, level=${cefrLevelForGeneration}`
    );
    // Feedback is null because no answer was submitted
    responsePayload.feedback = undefined;

    // Generate the exercise based on the determined level
    try {
      const exerciseResult = await generateExerciseResponse({
        passageLanguage: learn,
        questionLanguage: lang,
        cefrLevel: cefrLevelForGeneration,
      });

      if (exerciseResult.error || !exerciseResult.quizId) {
        console.error('[SubmitAnswer] Failed to generate new exercise:', exerciseResult.error);
        // Put the error in the main error field, as this was the primary goal
        responsePayload.error = exerciseResult.error || 'Generation failed';
        responsePayload.nextQuiz = undefined; // No quiz generated
      } else {
        try {
          const quizData = JSON.parse(exerciseResult.result) as PartialQuizData;
          console.log(
            `[SubmitAnswer] Successfully generated new exercise ID: ${exerciseResult.quizId}`
          );
          // Put the generated quiz into the `nextQuiz` field for consistency
          responsePayload.nextQuiz = {
            quizData: quizData,
            quizId: exerciseResult.quizId,
          };
          // Clear any non-blocking progress fetch error if generation succeeded
          if (responsePayload.error === 'Failed to fetch user progress, using defaults.') {
            responsePayload.error = undefined;
          }
        } catch (parseError) {
          console.error('[SubmitAnswer] Failed to parse new exercise JSON:', parseError);
          console.error('[SubmitAnswer] Problematic JSON:', exerciseResult.result);
          responsePayload.error = 'Failed to parse generated exercise data';
          responsePayload.nextQuiz = undefined;
        }
      }
    } catch (generationError) {
      console.error('[SubmitAnswer] Error calling generateExerciseResponse:', generationError);
      const message =
        generationError instanceof Error ? generationError.message : 'Unknown generation error';
      responsePayload.error = `Failed to generate exercise: ${message}`;
      responsePayload.nextQuiz = undefined;
    }
  }

  // 6. Return final payload
  console.log('[SubmitAnswer] Returning final payload:', {
    currentLevel: responsePayload.currentLevel,
    currentStreak: responsePayload.currentStreak,
    leveledUp: responsePayload.leveledUp,
    error: responsePayload.error,
    feedback: responsePayload.feedback ? '...' : undefined,
    nextQuiz: responsePayload.nextQuiz
      ? {
          quizId: responsePayload.nextQuiz.quizId,
          error: responsePayload.nextQuiz.error,
          quizData: '...',
        }
      : undefined,
  });
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
