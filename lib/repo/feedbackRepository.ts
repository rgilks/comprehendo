import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import db from '@/lib/db'; // Import Drizzle db instance
import { questionFeedback } from '@/lib/db/schema'; // Import Drizzle table schema

export const FeedbackInputSchema = z.object({
  quizId: z.number().int(),
  userId: z.number().int(),
  isGood: z.boolean(),
  userAnswer: z.string().optional(),
  isCorrect: z.boolean().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export const createFeedback = async (feedbackData: FeedbackInput): Promise<number> => {
  const validation = FeedbackInputSchema.safeParse(feedbackData);
  if (!validation.success) {
    console.error('[FeedbackRepository] Invalid input data for create:', validation.error);
    throw new Error(
      `Invalid feedback data: ${JSON.stringify(validation.error.flatten().fieldErrors)}`
    );
  }

  const { quizId, userId, isGood, userAnswer, isCorrect } = validation.data;

  const isCorrectValue = isCorrect ?? null;

  try {
    const result = await db
      .insert(questionFeedback)
      .values({
        quizId,
        userId,
        isGood,
        userAnswer: userAnswer ?? null,
        isCorrect: isCorrectValue,
      })
      .returning({ insertedId: questionFeedback.id });

    if (result.length === 0 || !result[0]?.insertedId) {
      console.error('[FeedbackRepository] Failed to insert feedback, no ID returned.');
      throw new Error('Failed to create feedback record.');
    }
    return result[0].insertedId;
  } catch (error) {
    console.error('[FeedbackRepository] Error creating question feedback:', error);
    throw error;
  }
};

export const findFeedbackByUserIdAndQuizId = async (
  userId: number,
  quizId: number
): Promise<FeedbackInput | null> => {
  try {
    const result = await db
      .select({
        quizId: questionFeedback.quizId,
        userId: questionFeedback.userId,
        isGood: questionFeedback.isGood,
        userAnswer: questionFeedback.userAnswer,
        isCorrect: questionFeedback.isCorrect,
      })
      .from(questionFeedback)
      .where(and(eq(questionFeedback.userId, userId), eq(questionFeedback.quizId, quizId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];

    return {
      quizId: row.quizId,
      userId: row.userId,
      isGood: row.isGood, // Drizzle handles boolean conversion
      userAnswer: row.userAnswer ?? undefined,
      isCorrect: row.isCorrect === null ? undefined : row.isCorrect,
    };
  } catch (error) {
    console.error(
      `[FeedbackRepository] Error finding feedback for user ${userId}, quiz ${quizId}:`,
      error
    );
    throw error;
  }
};
