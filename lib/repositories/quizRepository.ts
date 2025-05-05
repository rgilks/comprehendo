import { z } from 'zod';
import db from '@/lib/db'; // Import db

// Schema for the data structure stored in the quiz table's content column
// This should align with PartialQuizData or QuizData from domain schemas
export const QuizContentSchema = z.object({
  passage: z.string(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  answer: z.string(), // The correct option key (e.g., 'A')
  explanation: z.string(),
});

// Schema for the raw row returned by the database
const QuizRowSchema = z.object({
  id: z.number(),
  language: z.string(),
  level: z.string(),
  content: z.string(), // JSON string in the DB
  created_at: z.string(), // ISO 8601 string from DB
  question_language: z.string().nullable(),
  user_id: z.number().nullable(),
});

export type QuizRow = z.infer<typeof QuizRowSchema>;

// Schema for the fully parsed Quiz object, including parsed content
export const QuizSchema = QuizRowSchema.extend({
  content: QuizContentSchema,
});

export type Quiz = z.infer<typeof QuizSchema>;

// Finds a quiz by its ID
export const findQuizById = (id: number): Quiz | null => {
  try {
    const row = db.prepare('SELECT * FROM quiz WHERE id = ?').get(id) as QuizRow | undefined;
    if (!row) {
      return null;
    }
    // Validate the base row structure
    const rowParseResult = QuizRowSchema.safeParse(row);
    if (!rowParseResult.success) {
      console.error(
        `[QuizRepository] Invalid quiz row structure for ID ${id}:`,
        rowParseResult.error
      );
      return null;
    }
    // Parse the JSON content
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(row.content);
    } catch (jsonError) {
      console.error(`[QuizRepository] Failed to parse quiz content JSON for ID ${id}:`, jsonError);
      return null; // Return null if JSON parsing fails
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
    throw error; // Re-throw DB or JSON parsing errors
  }
};

// Creates a new quiz record
export const createQuiz = (
  language: string,
  level: string,
  questionLanguage: string | null,
  content: object, // Expects the structured content object
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

// Saves a generated exercise (similar to create, but takes JSON string)
export const saveExercise = (
  passageLanguage: string,
  questionLanguage: string | null,
  level: string,
  contentJson: string, // Expects JSON string directly
  userId: number | null
): number | bigint => {
  try {
    // Consider adding validation for contentJson if needed (e.g., try parsing it)
    const result = db
      .prepare(
        'INSERT INTO quiz (language, level, content, question_language, user_id) VALUES (?, ?, ?, ?, ?)'
      )
      .run(passageLanguage, level, contentJson, questionLanguage, userId);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('[QuizRepository] Error saving exercise:', error);
    throw error;
  }
};

// Finds a suitable cached quiz, excluding those the user has seen (feedback submitted)
export const findSuitableQuizForUser = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): Quiz | null => {
  try {
    let stmt;
    let row: QuizRow | undefined;

    // If user is logged in, exclude quizzes they've provided feedback for
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
           AND qf.user_id IS NULL -- Exclude if feedback exists for this user
         ORDER BY 
           q.created_at DESC -- Consider RANDOM() or other strategies?
         LIMIT 1`;
      stmt = db.prepare<[number, string, string, string]>(sql);
      row = stmt.get(userId, passageLanguage, questionLanguage, level) as QuizRow | undefined;
    } else {
      // If user is anonymous, find the latest suitable quiz
      const sql = `SELECT id, language, level, content, created_at, question_language, user_id
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ORDER BY created_at DESC 
         LIMIT 1`;
      stmt = db.prepare<[string, string, string]>(sql);
      row = stmt.get(passageLanguage, questionLanguage, level) as QuizRow | undefined;
    }

    if (!row) {
      return null; // No suitable quiz found
    }

    // Validate and parse the found row
    const rowParseResult = QuizRowSchema.safeParse(row);
    if (!rowParseResult.success) {
      console.error(
        `[QuizRepository] Invalid cached quiz row structure found for ${passageLanguage}/${level}:`,
        rowParseResult.error
      );
      return null;
    }

    // Parse the JSON content
    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(row.content);
    } catch (jsonError) {
      console.error(
        `[QuizRepository] Failed to parse cached quiz content JSON for ID ${row.id}:`,
        jsonError
      );
      return null; // Return null if JSON parsing fails
    }
    const contentParseResult = QuizContentSchema.safeParse(parsedContent);
    if (!contentParseResult.success) {
      console.error(
        `[QuizRepository] Invalid cached quiz content JSON found for ${passageLanguage}/${level}, ID ${row.id}:`,
        contentParseResult.error
      );
      return null;
    }

    return {
      ...rowParseResult.data,
      content: contentParseResult.data,
    };
  } catch (error) {
    console.error('[QuizRepository] Error finding suitable quiz:', error);
    throw error; // Re-throw DB or JSON parsing errors
  }
};

// Counts existing cached exercises matching criteria
export const countExercises = (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): number => {
  try {
    const stmt = db.prepare<
      [string, string, string],
      { count: number } // Define the expected return structure
    >(
      'SELECT COUNT(*) as count FROM quiz WHERE language = ? AND question_language = ? AND level = ?'
    );
    const result = stmt.get(passageLanguage, questionLanguage, level);
    return result?.count ?? 0; // Safely access count
  } catch (error) {
    console.error('[QuizRepository] Error counting exercises:', error);
    // Return 0 or re-throw? Returning 0 for now.
    return 0;
  }
};
