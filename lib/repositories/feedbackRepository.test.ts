import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import db from '@/lib/db';
import {
  createFeedback,
  findFeedbackByUserIdAndQuizId,
  type FeedbackInput,
} from './feedbackRepository';

vi.mock('@/lib/db', () => {
  const mockDb = {
    prepare: vi.fn(),
    run: vi.fn(),
    get: vi.fn(),
  };
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb };
});

const mockDb = db as unknown as {
  prepare: Mock;
  run: Mock;
  get: Mock;
};

describe('FeedbackRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.run.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 50 });
  });

  describe('createFeedback', () => {
    const validInput: FeedbackInput = {
      quiz_id: 101,
      user_id: 202,
      is_good: true,
      user_answer: 'B',
      is_correct: false,
    };

    it('should insert feedback with valid data and return lastInsertRowid', () => {
      const expectedRowId = 50;
      const result = createFeedback(validInput);

      expect(result).toBe(expectedRowId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO question_feedback (quiz_id, user_id, is_good, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        validInput.quiz_id,
        validInput.user_id,
        1,
        validInput.user_answer,
        0
      );
    });

    it('should handle optional fields being undefined', () => {
      const minimalInput: FeedbackInput = {
        quiz_id: 102,
        user_id: 203,
        is_good: false,
      };
      createFeedback(minimalInput);

      expect(mockDb.run).toHaveBeenCalledWith(
        minimalInput.quiz_id,
        minimalInput.user_id,
        0,
        null,
        null
      );
    });

    it('should throw validation error for invalid input data', () => {
      const invalidInput = {
        quiz_id: 'not-a-number',
        user_id: 204,
        is_good: 'yes',
      } as any;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => createFeedback(invalidInput)).toThrow(/Invalid feedback data:/);
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        '[FeedbackRepository] Invalid input data for create:',
        expect.anything()
      );
      errorSpy.mockRestore();
    });

    it('should throw database error if insert fails', () => {
      const dbError = new Error('DB Insert Failed');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => createFeedback(validInput)).toThrow(dbError);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[FeedbackRepository] Error creating question feedback:',
        dbError
      );
      errorSpy.mockRestore();
    });
  });

  describe('findFeedbackByUserIdAndQuizId', () => {
    const userId = 1;
    const quizId = 100;

    it('should return feedback data if found and transform 0/1 to booleans', () => {
      const mockDbRow = {
        quiz_id: quizId,
        user_id: userId,
        is_good: 1,
        user_answer: 'A',
        is_correct: 0,
      };
      mockDb.get.mockReturnValue(mockDbRow);

      const result = findFeedbackByUserIdAndQuizId(userId, quizId);

      expect(result).toEqual({
        quiz_id: quizId,
        user_id: userId,
        is_good: true,
        user_answer: 'A',
        is_correct: false,
      });
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT quiz_id, user_id, is_good, user_answer, is_correct FROM question_feedback WHERE user_id = ? AND quiz_id = ?'
      );
      expect(mockDb.get).toHaveBeenCalledWith(userId, quizId);
    });

    it('should correctly handle null values for optional fields from DB', () => {
      const mockDbRow = {
        quiz_id: quizId,
        user_id: userId,
        is_good: 0,
        user_answer: null,
        is_correct: null,
      };
      mockDb.get.mockReturnValue(mockDbRow);

      const result = findFeedbackByUserIdAndQuizId(userId, quizId);

      expect(result).toEqual({
        quiz_id: quizId,
        user_id: userId,
        is_good: false,
        user_answer: undefined,
        is_correct: undefined,
      });
    });

    it('should return null if feedback is not found', () => {
      mockDb.get.mockReturnValue(undefined);

      const result = findFeedbackByUserIdAndQuizId(userId, quizId);
      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(userId, quizId);
    });

    it('should throw and log an error if database query fails', () => {
      const dbError = new Error('DB Query Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => findFeedbackByUserIdAndQuizId(userId, quizId)).toThrow(dbError);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledWith(userId, quizId);
      expect(errorSpy).toHaveBeenCalledWith(
        `[FeedbackRepository] Error finding feedback for user ${userId}, quiz ${quizId}:`,
        dbError
      );
      errorSpy.mockRestore();
    });
  });
});
