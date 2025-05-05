import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateProgress,
  submitAnswer,
  getProgress,
  submitQuestionFeedback,
} from '@/app/actions/progress';
import { calculateAndUpdateProgress } from '@/lib/progressUtils';
import { getAuthenticatedUserId } from '@/app/actions/authUtils';
import db from '@/lib/db';

vi.mock('@/lib/progressUtils');
vi.mock('@/app/actions/authUtils');

// vi.mock factory now returns a new mock statement each time prepare is called
vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      run: vi.fn(),
    })),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the prepare mock itself
  vi.mocked(db.prepare).mockClear();
});

const MOCK_USER_ID = 1;
const MOCK_LANGUAGE = 'en';
const MOCK_QUIZ_ID = 101;

// Update MOCK_QUIZ_CONTENT to match the schema (needs A, B, C, D for options/explanations)
const MOCK_QUIZ_CONTENT = {
  paragraph: 'This is the paragraph text related to the question.',
  question: 'What is X?',
  options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
  correctAnswer: 'B',
  relevantText: 'Some relevant text.',
  allExplanations: {
    A: 'Explanation for A',
    B: 'Explanation for B',
    C: 'Explanation for C',
    D: 'Explanation for D',
  },
  difficulty: 'A2',
  topic: 'Test Topic',
};

describe('User Progress Server Actions', () => {
  // Tests for updateProgress
  describe('updateProgress', () => {
    const params = { isCorrect: true, language: MOCK_LANGUAGE };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const result = await updateProgress(params);
      expect(result.error).toBe('Unauthorized');
      expect(result.currentLevel).toBe('A1');
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const invalidParams = { isCorrect: 'yes' as any, language: 'e' }; // Invalid input
      const result = await updateProgress(invalidParams);
      expect(result.error).toBe('Invalid parameters');
      expect(result.currentLevel).toBe('A1');
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
    });

    it('should call calculateAndUpdateProgress and return its result on success', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockProgressResult = {
        currentLevel: 'B1' as const,
        currentStreak: 1,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const result = await updateProgress(params);

      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        params.language,
        params.isCorrect
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
    });

    it('should return error from calculateAndUpdateProgress if it fails', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockErrorResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
        error: 'DB Error',
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockErrorResult);

      const result = await updateProgress(params);

      expect(result).toEqual(mockErrorResult);
    });
  });

  // Tests for submitAnswer
  describe('submitAnswer', () => {
    const baseParams = { learn: MOCK_LANGUAGE, lang: 'de', id: MOCK_QUIZ_ID }; // lang: 'de' isn't used, but part of schema

    it('should return Invalid request parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const invalidParams = { ...baseParams, ans: 'too long' };
      const result = await submitAnswer(invalidParams);
      expect(result.error).toBe('Invalid request parameters.');
      expect(vi.mocked(db.prepare)).not.toHaveBeenCalled();
    });

    it('should return Missing or invalid quiz ID if id is missing', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const invalidParams = { ...baseParams, id: undefined };
      const result = await submitAnswer(invalidParams);
      expect(result.error).toBe('Missing or invalid quiz ID.');
    });

    it('should return Quiz data unavailable if quiz is not found', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      // Create a specific mock statement for this test
      const mockStatement = { get: vi.fn().mockReturnValue(undefined), run: vi.fn() };
      // Make db.prepare return this specific statement for this test case
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const result = await submitAnswer({ ...baseParams, ans: 'a' });

      expect(vi.mocked(db.prepare)).toHaveBeenCalledWith('SELECT content FROM quiz WHERE id = ?');
      // Check the call on the specific statement
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.error).toBe(`Quiz with ID ${MOCK_QUIZ_ID} not found or has invalid structure.`);
    });

    it('should return Quiz data unavailable if quiz content parsing fails', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = {
        get: vi.fn().mockReturnValue({ content: '{invalid json' }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const result = await submitAnswer({ ...baseParams, ans: 'a' });
      expect(result.error).toMatch(/Error retrieving quiz data for .*?: Expected property name/);
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
    });

    it('should process correct answer, generate feedback, and update progress for authenticated user', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = {
        get: vi.fn().mockReturnValue({ content: JSON.stringify(MOCK_QUIZ_CONTENT) }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);
      const mockProgressResult = {
        currentLevel: 'B1' as const,
        currentStreak: 1,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const params = { ...baseParams, ans: 'B' };
      const result = await submitAnswer(params);

      expect(result.feedback?.isCorrect).toBe(true);
      expect(result.feedback?.correctAnswer).toBe('B');
      expect(result.feedback?.correctExplanation).toBeDefined();
      expect(result.feedback?.chosenIncorrectExplanation).toBeNull();
      expect(result.feedback?.relevantText).toBeDefined();
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        true
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
    });

    it('should process incorrect answer, generate feedback, and update progress for authenticated user', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = {
        get: vi.fn().mockReturnValue({ content: JSON.stringify(MOCK_QUIZ_CONTENT) }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);
      const mockProgressResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockProgressResult);

      const params = { ...baseParams, ans: 'A' };
      const result = await submitAnswer(params);

      expect(result.feedback?.isCorrect).toBe(false);
      expect(result.feedback?.correctAnswer).toBe('B');
      expect(result.feedback?.chosenIncorrectExplanation).toBeDefined();
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        false
      );
      expect(result).toEqual(expect.objectContaining(mockProgressResult));
      expect(result.error).toBeUndefined();
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
    });

    it('should generate feedback but not update progress for anonymous user', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const mockStatement = {
        get: vi.fn().mockReturnValue({ content: JSON.stringify(MOCK_QUIZ_CONTENT) }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const params = { ...baseParams, ans: 'B', cefrLevel: 'B1' };
      const result = await submitAnswer(params);

      expect(result.feedback?.isCorrect).toBe(true);
      expect(vi.mocked(calculateAndUpdateProgress)).not.toHaveBeenCalled();
      expect(result.currentLevel).toBe('B1');
      expect(result.currentStreak).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
    });

    it('should return error from calculateAndUpdateProgress if it fails during progress update', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = {
        get: vi.fn().mockReturnValue({ content: JSON.stringify(MOCK_QUIZ_CONTENT) }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);
      const mockErrorResult = {
        currentLevel: 'A1' as const,
        currentStreak: 0,
        leveledUp: false,
        error: 'DB Error on Update',
      };
      vi.mocked(calculateAndUpdateProgress).mockReturnValue(mockErrorResult);

      const params = { ...baseParams, ans: 'B' };
      const result = await submitAnswer(params);

      expect(result.feedback?.isCorrect).toBe(true);
      expect(vi.mocked(calculateAndUpdateProgress)).toHaveBeenCalledWith(
        MOCK_USER_ID,
        MOCK_LANGUAGE,
        true
      );
      expect(result.error).toBe(mockErrorResult.error);
      expect(result.currentLevel).toBe(mockErrorResult.currentLevel);
      expect(result.currentStreak).toBe(mockErrorResult.currentStreak);
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
    });
  });

  // Tests for getProgress
  describe('getProgress', () => {
    const params = { language: MOCK_LANGUAGE };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const result = await getProgress(params);
      expect(result.error).toBe('Unauthorized: User not logged in.');
      expect(vi.mocked(db.prepare)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const invalidParams = { language: 'invalid-lang-code' };
      const result = await getProgress(invalidParams);
      expect(result.error).toBe('Invalid parameters provided.');
      expect(vi.mocked(db.prepare)).not.toHaveBeenCalled();
    });

    it('should return progress from DB if found', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockDbProgress = { cefr_level: 'B1', correct_streak: 3 };
      const mockStatement = { get: vi.fn().mockReturnValue(mockDbProgress), run: vi.fn() };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const result = await getProgress(params);

      expect(vi.mocked(db.prepare)).toHaveBeenCalledWith(
        expect.stringContaining('user_language_progress')
      );
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_USER_ID, params.language.slice(0, 2));
      expect(result.currentLevel).toBe(mockDbProgress.cefr_level);
      expect(result.currentStreak).toBe(mockDbProgress.correct_streak);
      expect(result.error).toBeUndefined();
    });

    it('should return default progress (A1, 0) if no record found in DB', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = { get: vi.fn().mockReturnValue(undefined), run: vi.fn() };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const result = await getProgress(params);

      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(result.error).toBeUndefined();
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_USER_ID, params.language.slice(0, 2));
    });

    it('should return error if DB query fails', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const dbError = new Error('DB connection failed');
      const mockStatement = {
        get: vi.fn().mockImplementation(() => {
          throw dbError;
        }),
        run: vi.fn(),
      };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any);

      const result = await getProgress(params);

      expect(result.error).toBe('Failed to retrieve progress due to a database error.');
      expect(result.currentLevel).toBe('A1');
      expect(result.currentStreak).toBe(0);
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_USER_ID, params.language.slice(0, 2));
    });
  });

  // Tests for submitQuestionFeedback
  describe('submitQuestionFeedback', () => {
    const params = {
      quizId: MOCK_QUIZ_ID,
      is_good: 1,
      passageLanguage: 'en',
      questionLanguage: 'de',
      currentLevel: 'B1',
      // userAnswer and isCorrect are optional
    };

    it('should return Unauthorized if user is not authenticated', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(null);
      const result = await submitQuestionFeedback(params);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
      expect(vi.mocked(db.prepare)).not.toHaveBeenCalled();
    });

    it('should return Invalid parameters for invalid input', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const invalidParams = { ...params, quizId: -5 }; // Invalid quiz ID
      const result = await submitQuestionFeedback(invalidParams);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameters');
      expect(vi.mocked(db.prepare)).not.toHaveBeenCalled();
    });

    it('should return Quiz not found if quiz ID does not exist', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockStatement = { get: vi.fn().mockReturnValue(undefined), run: vi.fn() };
      vi.mocked(db.prepare).mockReturnValueOnce(mockStatement as any); // For the SELECT id call

      const result = await submitQuestionFeedback(params);

      expect(vi.mocked(db.prepare)).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM quiz')
      );
      expect(mockStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Quiz not found.');
    });

    it('should insert feedback and return success if quiz exists and DB call succeeds', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockSelectStatement = {
        get: vi.fn().mockReturnValue({ id: MOCK_QUIZ_ID }),
        run: vi.fn(),
      };
      const mockInsertStatement = { get: vi.fn(), run: vi.fn() }; // Separate statement for insert

      // Mock prepare implementation to return different statements based on SQL
      vi.mocked(db.prepare).mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM quiz')) {
          return mockSelectStatement as any;
        } else if (sql.includes('INSERT INTO question_feedback')) {
          return mockInsertStatement as any;
        }
        return { get: vi.fn(), run: vi.fn() } as any; // Default fallback
      });

      const feedbackParams = { ...params, userAnswer: 'B', isCorrect: true };
      const result = await submitQuestionFeedback(feedbackParams);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(vi.mocked(db.prepare)).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM quiz')
      );
      expect(vi.mocked(db.prepare)).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO question_feedback')
      );
      expect(mockSelectStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(mockInsertStatement.run).toHaveBeenCalledWith(MOCK_QUIZ_ID, MOCK_USER_ID, 1, 'B', 1);
    });

    it('should handle optional userAnswer and isCorrect (null in DB)', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const mockSelectStatement = {
        get: vi.fn().mockReturnValue({ id: MOCK_QUIZ_ID }),
        run: vi.fn(),
      };
      const mockInsertStatement = { get: vi.fn(), run: vi.fn() };
      vi.mocked(db.prepare).mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM quiz')) return mockSelectStatement as any;
        if (sql.includes('INSERT INTO question_feedback')) return mockInsertStatement as any;
        return { get: vi.fn(), run: vi.fn() } as any;
      });

      const feedbackParams = { ...params, is_good: 0, isCorrect: false };
      const result = await submitQuestionFeedback(feedbackParams);

      expect(result.success).toBe(true);
      expect(mockSelectStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(mockInsertStatement.run).toHaveBeenCalledWith(
        MOCK_QUIZ_ID,
        MOCK_USER_ID,
        0,
        undefined,
        0
      );
    });

    it('should return error if DB insert fails', async () => {
      vi.mocked(getAuthenticatedUserId).mockResolvedValue(MOCK_USER_ID);
      const dbError = new Error('Insert failed');
      const mockSelectStatement = {
        get: vi.fn().mockReturnValue({ id: MOCK_QUIZ_ID }),
        run: vi.fn(),
      };
      const mockInsertStatement = {
        get: vi.fn(),
        run: vi.fn().mockImplementation(() => {
          throw dbError;
        }),
      };
      vi.mocked(db.prepare).mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM quiz')) return mockSelectStatement as any;
        if (sql.includes('INSERT INTO question_feedback')) return mockInsertStatement as any;
        return { get: vi.fn(), run: vi.fn() } as any;
      });

      const result = await submitQuestionFeedback(params);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error saving feedback.');
      expect(mockSelectStatement.get).toHaveBeenCalledWith(MOCK_QUIZ_ID);
      expect(mockInsertStatement.run).toHaveBeenCalled();
    });
  });
});
