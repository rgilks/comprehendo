import { z } from 'zod';
import db from '@/lib/db';

export const FeedbackInputSchema = z.object({
  quiz_id: z.number().int(),
  user_id: z.number().int(),
  is_good: z.boolean(),
  user_answer: z.string().optional(),
  is_correct: z.boolean().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export const createFeedback = (feedbackData: FeedbackInput): number | bigint => {
  const validation = FeedbackInputSchema.safeParse(feedbackData);
  if (!validation.success) {
    console.error('[FeedbackRepository] Invalid input data for create:', validation.error);
    throw new Error(
      `Invalid feedback data: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
    );
  }

  const { quiz_id, user_id, is_good, user_answer, is_correct } = validation.data;

  try {
    const result = db
      .prepare(
        'INSERT INTO question_feedback (quiz_id, user_id, is_good, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
      )
      .run(
        quiz_id,
        user_id,
        is_good ? 1 : 0,
        user_answer ?? null,
        is_correct === undefined ? null : is_correct ? 1 : 0
      );
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[FeedbackRepository] Error creating question feedback:', error);
    throw error; // Re-throw DB errors
  }
};

export const findFeedbackByUserIdAndQuizId = (
  userId: number,
  quizId: number
): FeedbackInput | null => {
  try {
    const row = db
      .prepare(
        'SELECT quiz_id, user_id, is_good, user_answer, is_correct FROM question_feedback WHERE user_id = ? AND quiz_id = ?'
      )
      .get(userId, quizId) as
      | {
          quiz_id: number;
          user_id: number;
          is_good: number;
          user_answer: string | null;
          is_correct: number | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      quiz_id: row.quiz_id,
      user_id: row.user_id,
      is_good: Boolean(row.is_good),
      user_answer: row.user_answer ?? undefined, // Convert null back to undefined if needed by schema
      is_correct: row.is_correct === null ? undefined : Boolean(row.is_correct),
    };
  } catch (error) {
    console.error(
      `[FeedbackRepository] Error finding feedback for user ${userId}, quiz ${quizId}:`,
      error
    );
    throw error; // Re-throw DB errors
  }
};
