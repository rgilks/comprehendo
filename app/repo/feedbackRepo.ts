import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import getDb from 'app/repo/db';
import { schema } from 'app/lib/db/adapter';

export const FeedbackInputSchema = z.object({
  quiz_id: z.number().int(),
  user_id: z.number().int(),
  is_good: z.boolean(),
  user_answer: z.string().optional(),
  is_correct: z.boolean().optional(),
});

export type FeedbackInput = z.infer<typeof FeedbackInputSchema>;

export const createFeedback = async (feedbackData: FeedbackInput): Promise<number> => {
  const validation = FeedbackInputSchema.safeParse(feedbackData);
  if (!validation.success) {
    console.error('[FeedbackRepository] Invalid input data for create:', validation.error);
    throw new Error(`Invalid feedback data: ${JSON.stringify(z.treeifyError(validation.error))}`);
  }

  const { quiz_id, user_id, is_good, user_answer, is_correct } = validation.data;

  try {
    const db = await getDb();

    const result = await db
      .insert(schema.questionFeedback)
      .values({
        quizId: quiz_id,
        userId: user_id,
        isGood: is_good ? 1 : 0,
        userAnswer: user_answer ?? null,
        isCorrect: is_correct === undefined ? null : is_correct ? 1 : 0,
      })
      .returning({ id: schema.questionFeedback.id });

    return result[0].id;
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
    const db = await getDb();

    const result = await db
      .select({
        quizId: schema.questionFeedback.quizId,
        userId: schema.questionFeedback.userId,
        isGood: schema.questionFeedback.isGood,
        userAnswer: schema.questionFeedback.userAnswer,
        isCorrect: schema.questionFeedback.isCorrect,
      })
      .from(schema.questionFeedback)
      .where(
        and(eq(schema.questionFeedback.userId, userId), eq(schema.questionFeedback.quizId, quizId))
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      quiz_id: row.quizId,
      user_id: row.userId,
      is_good: Boolean(row.isGood),
      user_answer: row.userAnswer ?? undefined,
      is_correct: row.isCorrect === null ? undefined : Boolean(row.isCorrect),
    };
  } catch (error) {
    console.error(
      `[FeedbackRepository] Error finding feedback for user ${userId}, quiz ${quizId}:`,
      error
    );
    throw error;
  }
};
