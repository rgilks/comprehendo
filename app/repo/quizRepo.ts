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

export const findQuizById = async (id: number): Promise<Quiz | null> => {
  try {
    const row = await db.prepare<QuizRow>('SELECT * FROM quiz WHERE id = ?').get(id);
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

export const createQuiz = async (
  language: string,
  level: string,
  questionLanguage: string | null,
  content: object,
  userId?: number | null
): Promise<number | null> => {
  try {
    const contentJson = JSON.stringify(content);
    const result = await db
      .prepare<{
        id: number;
      }>(
        'INSERT INTO quiz (language, level, question_language, content, user_id) VALUES (?, ?, ?, ?, ?) RETURNING id'
      )
      .get(language, level, questionLanguage ?? null, contentJson, userId ?? null);
    return result?.id ?? null;
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
    const result = (await db
      .prepare<{
        id: number;
      }>(
        'INSERT INTO quiz (language, level, content, question_language, user_id, created_at) VALUES (?, ?, ?, ?, ?, datetime("now")) RETURNING id'
      )
      .get(passageLanguage, level, contentJson, questionLanguage, userId)) as
      | { id: number }
      | undefined;
    return result?.id;
  } catch (error) {
    console.error('[QuizRepository] Error saving exercise:', error);
    return undefined;
  }
};

export const getCachedExerciseToAttempt = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): Promise<QuizRow | undefined> => {
  try {
    let stmt;
    let row: QuizRow | undefined;

    if (userId !== null) {
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
         ORDER BY 
           q.created_at DESC 
         LIMIT 1`;
      stmt = db.prepare<QuizRow>(sql);
      row = await stmt.get(userId, passageLanguage, questionLanguage, level);
    } else {
      const sql = `SELECT id, language, level, content, created_at, question_language, user_id
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ORDER BY created_at DESC
         LIMIT 1`;
      stmt = db.prepare<QuizRow>(sql);
      row = await stmt.get(passageLanguage, questionLanguage, level);
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

export const countCachedExercisesInRepo = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): Promise<number> => {
  try {
    const stmt = db.prepare<{ count: number }>(
      'SELECT COUNT(*) as count FROM quiz WHERE language = ? AND question_language = ? AND level = ?'
    );
    const result = await stmt.get(passageLanguage, questionLanguage, level);
    return result?.count ?? 0;
  } catch (error) {
    console.error('[QuizRepository] Error counting exercises:', error);
    throw error;
  }
};
