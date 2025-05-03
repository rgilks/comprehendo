import db from '@/lib/db';

export interface QuizRow {
  id: number;
  language: string;
  level: string;
  content: string;
  created_at: string;
  question_language: string | null;
}

export const getCachedExercise = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): QuizRow | undefined => {
  try {
    let stmt;
    let result;

    if (userId !== null) {
      const sql = `SELECT 
           q.id, q.language, q.level, q.content, q.created_at, q.question_language
         FROM 
           quiz q
         LEFT JOIN 
           question_feedback qf ON q.id = qf.quiz_id AND qf.user_id = ?
         WHERE 
           q.language = ? 
           AND q.question_language = ? 
           AND q.level = ?
           AND qf.user_id IS NULL -- Ensure no feedback exists for this user
         ORDER BY 
           q.created_at DESC 
         LIMIT 1`;
      stmt = db.prepare<[number, string, string, string]>(sql);
      result = stmt.get(userId, passageLanguage, questionLanguage, level) as QuizRow | undefined;
    } else {
      const sql = `SELECT id, language, level, content, created_at, question_language
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ORDER BY created_at DESC LIMIT 1`;
      stmt = db.prepare<[string, string, string]>(sql);
      result = stmt.get(passageLanguage, questionLanguage, level) as QuizRow | undefined;
    }

    return result;
  } catch (error) {
    console.error('[Cache] Error getting cached exercise:', error);
    return undefined;
  }
};

export const saveExerciseToCache = (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  jsonContent: string,
  userId: number | null
): number | undefined => {
  try {
    const result = db
      .prepare(
        `
        INSERT INTO quiz (language, question_language, level, content, created_at, user_id)
        VALUES (?, ?, ?, ?, datetime('now'), ?) -- Use datetime('now') explicitly and 6 placeholders
        RETURNING id
      `
      )
      .get(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId // Pass userId as the 5th argument corresponding to the 6th placeholder
      ) as { id: number } | undefined;

    if (result?.id) {
      return result.id;
    } else {
      console.error(
        '[Cache] Failed to get ID after saving to cache. Insert might have failed silently.'
      );
      return undefined;
    }
  } catch (error) {
    console.error('[Cache] Error saving exercise to cache:', error);
    return undefined;
  }
};

export const countCachedExercises = (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): number => {
  try {
    const stmt = db.prepare<[string, string, string]>(
      `SELECT COUNT(*) as count
       FROM quiz
       WHERE language = ? AND question_language = ? AND level = ?`
    );
    const result = stmt.get(passageLanguage, questionLanguage, level) as
      | { count: number }
      | undefined;
    return result?.count ?? 0;
  } catch (error) {
    console.error('[Cache] Error counting cached exercises:', error);
    return 0;
  }
};
