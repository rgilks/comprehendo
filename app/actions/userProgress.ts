'use server';

import db from '@/lib/db';
import { z } from 'zod';
import { QuizDataSchema, SubmitAnswerResultSchema } from '@/lib/domain/schemas';
import { calculateAndUpdateProgress } from '../../lib/userProgressUtils';
import { getAuthenticatedUserId } from './authUtils';

const DEFAULT_CEFR_LEVEL = 'A1';

const updateProgressSchema = z.object({
  isCorrect: z.boolean(),
  language: z.string().min(2).max(5),
});

const getProgressSchema = z.object({
  language: z.string().min(2).max(5),
});

const submitAnswerSchema = z.object({
  ans: z.string().length(1).optional(),
  learn: z.string().min(2).max(5),
  lang: z.string().min(2).max(5),
  id: z.number().int().positive().optional(),
  cefrLevel: z.string().optional(),
});

const submitFeedbackSchema = z.object({
  quizId: z.number().int().positive(),
  is_good: z.number().int().min(0).max(1),
  userAnswer: z.string().optional(),
  isCorrect: z.boolean().optional(),
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  currentLevel: z.string(),
});

export type UpdateProgressParams = z.infer<typeof updateProgressSchema>;
export type GetProgressParams = z.infer<typeof getProgressSchema>;
export type SubmitFeedbackParams = z.infer<typeof submitFeedbackSchema>;

type FeedbackType = z.infer<typeof SubmitAnswerResultSchema>['feedback'];

export interface ProgressResponse {
  currentLevel: string;
  currentStreak: number;
  leveledUp?: boolean;
  error?: string;
  feedback?: FeedbackType;
}

// Schema for parsing the row from the quiz table
const QuizContentSchema = z.object({
  content: z.string(),
});

// Schema for parsing the row from the user_language_progress table
const UserProgressSchema = z.object({
  cefr_level: z.string(),
  correct_streak: z.number().int(),
});

// Helper function to fetch and parse quiz data
const getParsedQuizData = (
  quizId: number
): { data: z.infer<typeof QuizDataSchema> | null; error?: string } => {
  try {
    const quizRecord = db.prepare('SELECT content FROM quiz WHERE id = ?').get(quizId);

    const parsedRecord = QuizContentSchema.safeParse(quizRecord);
    if (!parsedRecord.success) {
      // Quiz not found or record is malformed
      return { data: null, error: `Quiz with ID ${quizId} not found or has invalid structure.` };
    }

    const parsedContent = QuizDataSchema.safeParse(JSON.parse(parsedRecord.data.content));

    if (!parsedContent.success) {
      console.error(
        `[getParsedQuizData] Failed to parse quiz content (ID: ${quizId}) using QuizDataSchema: ${JSON.stringify(parsedContent.error.flatten())}`
      );
      return { data: null, error: `Failed to parse content for quiz ID ${quizId}.` };
    }
    return { data: parsedContent.data };
  } catch (error: unknown) {
    console.error(`[getParsedQuizData] Error processing quiz ID ${quizId}:`, error);
    return {
      data: null,
      error: `Error retrieving quiz data for ${quizId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

// Helper function to generate feedback based on answer and quiz data
const generateFeedback = (
  quizId: number,
  fullQuizData: z.infer<typeof QuizDataSchema>,
  userAnswer: string | undefined
): { isCorrect: boolean; feedbackData: FeedbackType } => {
  let isCorrect = false;
  let feedbackData: FeedbackType = undefined;

  try {
    const correctAnswerKey = fullQuizData.correctAnswer as keyof typeof fullQuizData.options | null;
    const allExplanations = fullQuizData.allExplanations;

    if (
      typeof userAnswer === 'string' &&
      userAnswer in fullQuizData.options &&
      correctAnswerKey &&
      allExplanations
    ) {
      const chosenAnswerKey = userAnswer as keyof typeof fullQuizData.options;
      isCorrect = chosenAnswerKey === correctAnswerKey;

      const correctExplanation = allExplanations[correctAnswerKey];
      const relevantText = fullQuizData.relevantText;
      let chosenIncorrectExplanation: string | undefined | null = null;

      if (!isCorrect) {
        chosenIncorrectExplanation = allExplanations[chosenAnswerKey];
      }

      if (correctExplanation && relevantText) {
        feedbackData = {
          isCorrect: isCorrect,
          correctAnswer: correctAnswerKey,
          correctExplanation: correctExplanation,
          chosenIncorrectExplanation: chosenIncorrectExplanation,
          relevantText: relevantText,
        };
      } else {
        console.warn(
          `[generateFeedback] Missing correctExplanation or relevantText for quiz ID ${quizId}.`
        );
      }
    } else {
      if (!correctAnswerKey)
        console.warn(`[generateFeedback] Missing correctAnswerKey for quiz ID ${quizId}.`);
      if (!allExplanations)
        console.warn(`[generateFeedback] Missing allExplanations for quiz ID ${quizId}.`);
    }
  } catch (error: unknown) {
    // Log error, but return default values to avoid crashing the whole process
    console.error(`[generateFeedback] Error processing feedback for quiz ID ${quizId}:`, error);
    // isCorrect remains false, feedbackData remains undefined
  }

  return { isCorrect, feedbackData };
};

export const updateProgress = async (params: UpdateProgressParams): Promise<ProgressResponse> => {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return { currentLevel: DEFAULT_CEFR_LEVEL, currentStreak: 0, error: 'Unauthorized' };
  }

  const parsedBody = updateProgressSchema.safeParse(params);
  if (!parsedBody.success) {
    // Log detailed error server-side
    console.error(
      `[updateProgress] Invalid parameters for user ${userId}:`,
      parsedBody.error.flatten()
    );
    return { currentLevel: DEFAULT_CEFR_LEVEL, currentStreak: 0, error: 'Invalid parameters' }; // Generic client message
  }

  const { isCorrect, language } = parsedBody.data;
  const progressResult = calculateAndUpdateProgress(userId, language, isCorrect);

  // Conditionally construct the response object to handle exactOptionalPropertyTypes
  const response: ProgressResponse = {
    currentLevel: progressResult.currentLevel,
    currentStreak: progressResult.currentStreak,
    leveledUp: progressResult.leveledUp,
    ...(progressResult.error && { error: progressResult.error }), // Add error only if it exists
  };

  return response;
};

// Helper function to update user progress and modify the response payload
const updateUserProgressAndGetResponse = (
  userId: number,
  language: string,
  isCorrect: boolean,
  responsePayload: ProgressResponse
): ProgressResponse => {
  const progressUpdate = calculateAndUpdateProgress(userId, language, isCorrect);

  // Update payload with actual progress
  responsePayload.currentLevel = progressUpdate.currentLevel;
  responsePayload.currentStreak = progressUpdate.currentStreak;
  responsePayload.leveledUp = progressUpdate.leveledUp;

  // Conditionally add the error property if it exists from progressUpdate
  if (progressUpdate.error) {
    console.error(
      `[SubmitAnswer/updateHelper] Progress update failed for user ${userId}: ${progressUpdate.error}`
    );
    // Overwrite potential existing error or add new one
    responsePayload.error = progressUpdate.error;
  }

  return responsePayload;
};

export const submitAnswer = async (
  params: z.infer<typeof submitAnswerSchema>
): Promise<ProgressResponse> => {
  const userId = await getAuthenticatedUserId(); // userId can be null for anonymous users

  const parsedBody = submitAnswerSchema.safeParse(params);
  if (!parsedBody.success) {
    console.error(
      `[submitAnswer] Invalid request parameters (userId: ${userId ?? 'anonymous'}):`,
      parsedBody.error.flatten()
    );
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: 'Invalid request parameters.', // Generic message
    };
  }

  const { ans, id, learn, cefrLevel: requestCefrLevel } = parsedBody.data;

  if (typeof id !== 'number') {
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: 'Missing or invalid quiz ID.', // Generic message
    };
  }

  const { data: fullQuizData, error: quizError } = getParsedQuizData(id);
  if (quizError || !fullQuizData) {
    // getParsedQuizData already logs the specific error
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: quizError || `Quiz data unavailable.`, // Use error from helper or generic message
    };
  }

  // generateFeedback logs its own errors internally
  const { isCorrect, feedbackData } = generateFeedback(id, fullQuizData, ans);

  // Initialize response with defaults and feedback
  let responsePayload: ProgressResponse = {
    currentLevel: requestCefrLevel || DEFAULT_CEFR_LEVEL, // Default for anonymous or if progress update fails
    currentStreak: 0,
    leveledUp: false,
    feedback: feedbackData,
  };

  // Attempt to update progress only for authenticated users
  if (userId !== null) {
    responsePayload = updateUserProgressAndGetResponse(userId, learn, isCorrect, responsePayload);
  } else {
    // Anonymous user defaults are set during initialization
  }

  return responsePayload;
};

export const getProgress = async (params: GetProgressParams): Promise<ProgressResponse> => {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: 'Unauthorized: User not logged in.',
    };
  }

  const parsedParams = getProgressSchema.safeParse(params);
  if (!parsedParams.success) {
    console.error(
      `[getProgress] Invalid parameters for user ${userId}:`,
      parsedParams.error.flatten()
    );
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: 'Invalid parameters provided.',
    };
  }

  const normalizedLanguage = parsedParams.data.language.toLowerCase().slice(0, 2);

  try {
    const progressRecord = db
      .prepare(
        'SELECT cefr_level, correct_streak FROM user_language_progress WHERE user_id = ? AND language_code = ?'
      )
      .get(userId, normalizedLanguage);

    const parsedProgress = UserProgressSchema.safeParse(progressRecord);

    if (!parsedProgress.success) {
      // Either no record exists, or the record is malformed. Treat as no progress.
      // Log if malformed? For now, assume it's just no record.
      return {
        currentLevel: DEFAULT_CEFR_LEVEL,
        currentStreak: 0,
      };
    }

    return {
      currentLevel: parsedProgress.data.cefr_level,
      currentStreak: parsedProgress.data.correct_streak,
    };
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(
      `[GetProgress] Database error for user ${userId}, language ${normalizedLanguage}: ${message}`
    );
    return {
      currentLevel: DEFAULT_CEFR_LEVEL,
      currentStreak: 0,
      error: `Failed to retrieve progress due to a database error.`, // Generic message
    };
  }
};

export interface SubmitFeedbackResponse {
  success: boolean;
  error?: string;
  cached?: boolean;
}

export const submitQuestionFeedback = async (
  params: SubmitFeedbackParams
): Promise<SubmitFeedbackResponse> => {
  const userId = await getAuthenticatedUserId();
  if (userId === null) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsedBody = submitFeedbackSchema.safeParse(params);
  if (!parsedBody.success) {
    console.error(
      `[SubmitFeedback] Invalid parameters for user ${userId}:`,
      parsedBody.error.flatten()
    );
    return { success: false, error: 'Invalid parameters' };
  }

  const { quizId, is_good, userAnswer, isCorrect } = parsedBody.data;

  try {
    const quizExists = db.prepare('SELECT id FROM quiz WHERE id = ?').get(quizId);
    if (!quizExists) {
      // Log specific error, return generic one
      console.error(`[SubmitFeedback] Quiz ID ${quizId} not found for user ${userId}.`);
      return { success: false, error: `Quiz not found.` };
    }

    db.prepare(
      'INSERT INTO question_feedback (quiz_id, user_id, is_good, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
    ).run(quizId, userId, is_good, userAnswer, isCorrect === undefined ? null : isCorrect ? 1 : 0);
    return { success: true }; // Return success
  } catch (dbError) {
    const message = dbError instanceof Error ? dbError.message : 'Unknown DB error';
    console.error(`[SubmitFeedback] Database error for user ${userId}, quiz ${quizId}: ${message}`);
    return { success: false, error: `Database error saving feedback.` }; // Generic message
  }
};
