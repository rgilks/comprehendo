import { z } from 'zod';
import db from '@/lib/db'; // Import db

// Schema for the data being inserted
export const FeedbackInputSchema = z.object({
  quiz_id: z.number().int(),
  user_id: z.number().int(),
  is_good: z.boolean(), // Store as 0 or 1 in DB
  user_answer: z.string().optional(), // e.g., 'A', 'B'
  is_correct: z.boolean().optional(), // Store as 0 or 1 in DB
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

/**
 * Creates a new feedback record.
 * Validates input against the schema before insertion.
 */
export const createFeedback = (feedbackData: FeedbackInput): number | bigint => {
  // Validate input data
  const validation = FeedbackInputSchema.safeParse(feedbackData);
  if (!validation.success) {
    console.error('[FeedbackRepository] Invalid input data for create:', validation.error);
    // Use JSON.stringify for the error details to avoid [object Object]
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

// Add other methods if needed, e.g., findByUserId, findByQuizId, etc.
