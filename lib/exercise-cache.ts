import db from '@/lib/db';
import { quiz, questionFeedback } from '@/lib/db/schema';
import { eq, and, sql, desc, count as dslCount, SQL } from 'drizzle-orm';
import { QuizDataSchema, type PartialQuizData } from '@/lib/domain/schemas';
import type { RunResult } from 'better-sqlite3';

// The QuizRow type from Drizzle schema (quiz.$inferSelect) should be preferred.
// This local QuizRow might differ slightly (e.g. created_at vs createdAt field name and type Date vs string).
// For consistency, we should align with Drizzle's output.
// type QuizRowFromDb = typeof quiz.$inferSelect;

// This interface was based on direct DB output. Drizzle will return fields as defined in schema.ts (e.g., createdAt as Date)
export interface QuizRow {
  id: number;
  language: string;
  level: string;
  content: string;
  createdAt: Date | null; // Changed from created_at: string to align with Drizzle schema output
  questionLanguage: string | null;
  // userId is not selected in the original getCachedExercise SQL, but present in quiz table.
  // If it were selected, it would be: userId: number | null;
}

export const getCachedExercise = (
  passageLanguage: string,
  questionLanguageInput: string,
  levelInput: string,
  userIdInput: number | null
): QuizRow | undefined => {
  try {
    const conditions: (SQL | undefined)[] = [
      eq(quiz.language, passageLanguage),
      eq(quiz.questionLanguage, questionLanguageInput),
      eq(quiz.level, levelInput),
    ];

    if (userIdInput !== null) {
      const feedbackSubQuery = db
        .select({ quizId: questionFeedback.quizId })
        .from(questionFeedback)
        .where(eq(questionFeedback.userId, userIdInput));
      conditions.push(sql`${quiz.id} NOT IN ${feedbackSubQuery}`);
    }

    const row: typeof quiz.$inferSelect | undefined = db
      .select()
      .from(quiz)
      .where(and(...conditions.filter((c) => c !== undefined))) // Filter out undefined and cast
      .orderBy(desc(quiz.createdAt))
      .limit(1)
      .get();

    if (!row) return undefined;

    // The row from Drizzle already matches the field names (id, language, level, content, createdAt, questionLanguage)
    // The types also match (createdAt is Date | null).
    // So a direct cast or return should be fine if QuizRow is identical to typeof quiz.$inferSelect (excluding userId if not selected)
    // For this function, QuizRow does not include userId, and quiz.$inferSelect does. So we need to map or ensure selection matches QuizRow.

    // Let's make sure we only select what QuizRow expects, or use a more precise type for row.
    const selectedRow = db
      .select({
        id: quiz.id,
        language: quiz.language,
        level: quiz.level,
        content: quiz.content,
        createdAt: quiz.createdAt,
        questionLanguage: quiz.questionLanguage,
      })
      .from(quiz)
      .where(and(...conditions.filter((c) => c !== undefined)))
      .orderBy(desc(quiz.createdAt))
      .limit(1)
      .get();

    if (!selectedRow) return undefined;

    return selectedRow as QuizRow; // selectedRow now structurally matches QuizRow
  } catch (error) {
    console.error('[Cache] Error getting cached exercise:', error);
    return undefined;
  }
};

export const saveExerciseToCache = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  jsonContent: string,
  userId: number | null
): Promise<number | undefined> => {
  try {
    const executionResult: RunResult = await db
      .insert(quiz)
      .values({
        language: passageLanguage,
        questionLanguage: questionLanguage,
        level: level,
        content: jsonContent,
        userId: userId,
        // createdAt will use the default from the schema (CURRENT_TIMESTAMP)
      })
      .execute();

    if (executionResult.lastInsertRowid) {
      return typeof executionResult.lastInsertRowid === 'bigint'
        ? Number(executionResult.lastInsertRowid)
        : executionResult.lastInsertRowid;
    } else {
      console.error(
        '[Cache] Failed to get ID after saving to cache. Insert might have failed silently.'
      );
      return undefined;
    }
  } catch (error) {
    console.error('[Cache] Error saving exercise to cache:', error);
    return undefined; // Return undefined on error as per original function
  }
};

export const countCachedExercises = (
  passageLanguage: string,
  questionLanguageInput: string,
  levelInput: string
): number => {
  try {
    const result = db
      .select({ value: dslCount() })
      .from(quiz)
      .where(
        and(
          eq(quiz.language, passageLanguage),
          eq(quiz.questionLanguage, questionLanguageInput),
          eq(quiz.level, levelInput)
        )
      )
      .get();
    return result?.value ?? 0;
  } catch (error) {
    console.error('[Cache] Error counting cached exercises:', error);
    return 0;
  }
};

// Helper function to get and validate a cached exercise
export const getValidatedExerciseFromCache = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): { quizData: PartialQuizData; quizId: number } | undefined => {
  const cachedExerciseRow: QuizRow | undefined = getCachedExercise(
    passageLanguage,
    questionLanguage,
    level,
    userId
  );

  if (cachedExerciseRow) {
    try {
      const parsedCachedContent: unknown = JSON.parse(cachedExerciseRow.content);
      const validatedCachedData = QuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error(
          '[Cache:getValidated] Invalid data found in cache for ID',
          cachedExerciseRow.id,
          ':',
          validatedCachedData.error.format()
        );
        return undefined;
      } else {
        const fullData = validatedCachedData.data;
        const partialData: PartialQuizData = {
          paragraph: fullData.paragraph,
          question: fullData.question,
          options: fullData.options,
          topic: fullData.topic,
        };
        return {
          quizData: partialData,
          quizId: cachedExerciseRow.id,
        };
      }
    } catch (error) {
      console.error(
        '[Cache:getValidated] Error processing cached exercise ID',
        cachedExerciseRow.id,
        ':',
        error
      );
      return undefined;
    }
  }
  return undefined;
};
