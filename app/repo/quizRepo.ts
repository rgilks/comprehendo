import { z } from 'zod';
import db from 'app/repo/db';

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

const QuizRowSchema = z.object({
  id: z.number(),
  language: z.string(),
  level: z.string(),
  content: z.string(),
  created_at: z.string(),
  question_language: z.string().nullable(),
  user_id: z.number().nullable(),
});

export type QuizRow = z.infer<typeof QuizRowSchema>;

export const QuizSchema = QuizRowSchema.extend({
  content: QuizContentSchema,
});

export type Quiz = z.infer<typeof QuizSchema>;

export const findQuizById = (id: number): Quiz | null => {
  try {
    const row = db.prepare('SELECT * FROM quiz WHERE id = ?').get(id) as QuizRow | undefined;
    if (!row) {
      return null;
    }
    const rowParseResult = QuizRowSchema.safeParse(row);
    if (!rowParseResult.success) {
      console.error(
        `[QuizRepository] Invalid quiz row structure for ID ${id}:`,
        rowParseResult.error
      );
      return null;
    }
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(row.content);
    } catch (jsonError) {
      console.error(`[QuizRepository] Failed to parse quiz content JSON for ID ${id}:`, jsonError);
      return null;
    }

    const contentParseResult = QuizContentSchema.safeParse(parsedContent);
    if (!contentParseResult.success) {
      console.error(
        `[QuizRepository] Invalid quiz content JSON for ID ${id}:`,
        contentParseResult.error
      );
      return null;
    }

    return {
      ...rowParseResult.data,
      content: contentParseResult.data,
    };
  } catch (error) {
    console.error(`[QuizRepository] Error fetching quiz by ID ${id}:`, error);
    throw error;
  }
};

export const createQuiz = (
  language: string,
  level: string,
  questionLanguage: string | null,
  content: object,
  userId?: number | null
): number | bigint => {
  try {
    const contentJson = JSON.stringify(content);
    const result = db
      .prepare(
        'INSERT INTO quiz (language, level, question_language, content, user_id) VALUES (?, ?, ?, ?, ?)'
      )
      .run(language, level, questionLanguage ?? null, contentJson, userId ?? null);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[QuizRepository] Error creating quiz:', error);
    throw error;
  }
};

export const saveExercise = (
  passageLanguage: string,
  questionLanguage: string | null,
  level: string,
  contentJson: string,
  userId: number | null
): number | undefined => {
  try {
    const result = db
      .prepare(
        'INSERT INTO quiz (language, level, content, question_language, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now")) RETURNING id'
      )
      .get(passageLanguage, level, contentJson, questionLanguage, userId) as
      | { id: number }
      | undefined;
    return result?.id;
  } catch (error) {
    console.error('[QuizRepository] Error saving exercise:', error);
    return undefined;
  }
};

export const getCachedExerciseToAttempt = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null,
  excludeQuizId?: number | null
): QuizRow | undefined => {
  try {
    let stmt;
    let row: QuizRow | undefined;

    if (userId !== null) {
      // For logged-in users, exclude quizzes they've already given feedback on
      const excludeIdClause = excludeQuizId ? 'AND q.id != ?' : '';
      const sql = `SELECT 
           q.id, q.language, q.level, q.content, q.created_at, q.question_language, q.user_id
         FROM 
           quiz q
         LEFT JOIN 
           question_feedback qf ON q.id = qf.quiz_id AND qf.user_id = ?
         WHERE 
           q.language = ? 
           AND q.question_language = ? 
           AND q.level = ?
           AND qf.user_id IS NULL
           ${excludeIdClause}
         ORDER BY 
           q.created_at DESC 
         LIMIT 1`;

      if (excludeQuizId) {
        stmt = db.prepare<[number, string, string, string, number]>(sql);
        row = stmt.get(userId, passageLanguage, questionLanguage, level, excludeQuizId) as
          | QuizRow
          | undefined;
      } else {
        stmt = db.prepare<[number, string, string, string]>(sql);
        row = stmt.get(userId, passageLanguage, questionLanguage, level) as QuizRow | undefined;
      }
    } else {
      // For anonymous users, exclude the last shown quiz ID to prevent repeats
      const excludeIdClause = excludeQuizId ? 'AND id != ?' : '';
      const sql = `SELECT id, language, level, content, created_at, question_language, user_id
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ${excludeIdClause}
         ORDER BY created_at DESC 
         LIMIT 1`;

      if (excludeQuizId) {
        stmt = db.prepare<[string, string, string, number]>(sql);
        row = stmt.get(passageLanguage, questionLanguage, level, excludeQuizId) as
          | QuizRow
          | undefined;
      } else {
        stmt = db.prepare<[string, string, string]>(sql);
        row = stmt.get(passageLanguage, questionLanguage, level) as QuizRow | undefined;
      }
    }

    if (!row) {
      return undefined;
    }
    return QuizRowSchema.parse(row);
  } catch (error) {
    console.error('[QuizRepository] Error finding suitable quiz:', error);
    return undefined;
  }
};

export const countCachedExercisesInRepo = (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): number => {
  try {
    const stmt = db.prepare<[string, string, string], { count: number }>(
      'SELECT COUNT(*) as count FROM quiz WHERE language = ? AND question_language = ? AND level = ?'
    );
    const result = stmt.get(passageLanguage, questionLanguage, level);
    return result?.count ?? 0;
  } catch (error) {
    console.error('[QuizRepository] Error counting exercises:', error);
    throw error;
  }
};
