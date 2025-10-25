import { z } from 'zod';
import { eq, and, isNull, desc, sql, count } from 'drizzle-orm';
import getDb from 'app/repo/db';
import { schema } from 'app/lib/db/adapter';

export const QuizContentSchema = z.object({
  paragraph: z.string(),
  topic: z.string().optional().nullable(),
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correctAnswer: z.string(),
  allExplanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  relevantText: z.string().optional().nullable(),
});

export type QuizContent = z.infer<typeof QuizContentSchema>;

export type Quiz = typeof schema.quiz.$inferSelect & {
  content: QuizContent;
};

export const findQuizById = async (id: number): Promise<typeof schema.quiz.$inferSelect | null> => {
  try {
    const db = await getDb();
    const row = await db.select().from(schema.quiz).where(eq(schema.quiz.id, id)).limit(1);

    if (row.length === 0) {
      return null;
    }

    const quizRow = row[0];

    return quizRow;
  } catch (error) {
    console.error(`[QuizRepository] Error fetching quiz by ID ${id}:`, error);
    throw error;
  }
};

export const createQuiz = async (
  language: string,
  level: string,
  questionLanguage: string | null,
  content: object,
  userId?: number | null
): Promise<number> => {
  try {
    const db = await getDb();
    const contentJson = JSON.stringify(content);

    const result = await db
      .insert(schema.quiz)
      .values({
        language,
        level,
        questionLanguage,
        content: contentJson,
        userId,
      })
      .returning({ id: schema.quiz.id });

    return result[0].id;
  } catch (error) {
    console.error('[QuizRepository] Error creating quiz:', error);
    throw error;
  }
};

export const saveExercise = async (
  passageLanguage: string,
  questionLanguage: string | null,
  level: string,
  contentJson: string,
  userId: number | null
): Promise<number | undefined> => {
  try {
    console.log('[QuizRepository] Attempting to save exercise:', {
      passageLanguage,
      questionLanguage,
      level,
      contentLength: contentJson.length,
      userId,
    });

    const db = await getDb();
    const result = await db
      .insert(schema.quiz)
      .values({
        language: passageLanguage,
        level,
        content: contentJson,
        questionLanguage,
        userId,
      })
      .returning({ id: schema.quiz.id });

    if (result.length === 0) {
      console.error('[QuizRepository] Failed to get ID from database insert');
      return undefined;
    }

    console.log('[QuizRepository] Successfully saved exercise with ID:', result[0].id);
    return result[0].id;
  } catch (error) {
    console.error('[QuizRepository] Error saving exercise:', error);
    console.error('[QuizRepository] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return undefined;
  }
};

export const getCachedExerciseToAttempt = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null,
  excludeQuizId?: number | null
): Promise<typeof schema.quiz.$inferSelect | undefined> => {
  try {
    const db = await getDb();
    let result;

    if (userId !== null) {
      const excludeCondition = excludeQuizId ? and(eq(schema.quiz.id, excludeQuizId)) : undefined;

      result = await db
        .select({
          id: schema.quiz.id,
          language: schema.quiz.language,
          level: schema.quiz.level,
          content: schema.quiz.content,
          createdAt: schema.quiz.createdAt,
          questionLanguage: schema.quiz.questionLanguage,
          userId: schema.quiz.userId,
        })
        .from(schema.quiz)
        .leftJoin(
          schema.questionFeedback,
          and(
            eq(schema.questionFeedback.quizId, schema.quiz.id),
            eq(schema.questionFeedback.userId, userId)
          )
        )
        .where(
          and(
            eq(schema.quiz.language, passageLanguage),
            eq(schema.quiz.questionLanguage, questionLanguage),
            eq(schema.quiz.level, level),
            isNull(schema.questionFeedback.userId),
            excludeCondition
          )
        )
        .orderBy(desc(schema.quiz.createdAt))
        .limit(1);
    } else {
      const excludeCondition = excludeQuizId ? and(eq(schema.quiz.id, excludeQuizId)) : undefined;

      result = await db
        .select()
        .from(schema.quiz)
        .where(
          and(
            eq(schema.quiz.language, passageLanguage),
            eq(schema.quiz.questionLanguage, questionLanguage),
            eq(schema.quiz.level, level),
            excludeCondition
          )
        )
        .orderBy(desc(schema.quiz.createdAt))
        .limit(1);
    }

    return result[0];
  } catch (error) {
    console.error('[QuizRepository] Error finding suitable quiz:', error);
    return undefined;
  }
};

export const countCachedExercisesInRepo = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): Promise<number> => {
  try {
    const db = await getDb();
    const result = await db
      .select({ count: count() })
      .from(schema.quiz)
      .where(
        and(
          eq(schema.quiz.language, passageLanguage),
          eq(schema.quiz.questionLanguage, questionLanguage),
          eq(schema.quiz.level, level)
        )
      );

    return result[0].count;
  } catch (error) {
    console.error('[QuizRepository] Error counting exercises:', error);
    throw error;
  }
};

export const getRandomGoodQuestion = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null,
  excludeQuizId?: number | null
): Promise<typeof schema.quiz.$inferSelect | undefined> => {
  try {
    const db = await getDb();
    let result;

    if (userId !== null) {
      const excludeCondition = excludeQuizId ? and(eq(schema.quiz.id, excludeQuizId)) : undefined;

      result = await db
        .select({
          id: schema.quiz.id,
          language: schema.quiz.language,
          level: schema.quiz.level,
          content: schema.quiz.content,
          createdAt: schema.quiz.createdAt,
          questionLanguage: schema.quiz.questionLanguage,
          userId: schema.quiz.userId,
        })
        .from(schema.quiz)
        .innerJoin(schema.questionFeedback, eq(schema.questionFeedback.quizId, schema.quiz.id))
        .where(
          and(
            eq(schema.quiz.language, passageLanguage),
            eq(schema.quiz.questionLanguage, questionLanguage),
            eq(schema.quiz.level, level),
            eq(schema.questionFeedback.isGood, 1),
            isNull(schema.questionFeedback.userId),
            excludeCondition
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(1);
    } else {
      const excludeCondition = excludeQuizId ? and(eq(schema.quiz.id, excludeQuizId)) : undefined;

      result = await db
        .select({
          id: schema.quiz.id,
          language: schema.quiz.language,
          level: schema.quiz.level,
          content: schema.quiz.content,
          createdAt: schema.quiz.createdAt,
          questionLanguage: schema.quiz.questionLanguage,
          userId: schema.quiz.userId,
        })
        .from(schema.quiz)
        .innerJoin(schema.questionFeedback, eq(schema.questionFeedback.quizId, schema.quiz.id))
        .where(
          and(
            eq(schema.quiz.language, passageLanguage),
            eq(schema.quiz.questionLanguage, questionLanguage),
            eq(schema.quiz.level, level),
            eq(schema.questionFeedback.isGood, 1),
            excludeCondition
          )
        )
        .orderBy(sql`RANDOM()`)
        .limit(1);
    }

    return result[0];
  } catch (error) {
    console.error('[QuizRepository] Error finding random good question:', error);
    return undefined;
  }
};
