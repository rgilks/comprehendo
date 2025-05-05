import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import db from '@/lib/db'; // Mock this
import {
  QuestionFeedbackRepository,
  type QuestionFeedbackInput,
} from './questionFeedbackRepository';

// Mock the db dependency
vi.mock('@/lib/db', () => {
  const mockDb = {
    prepare: vi.fn(),
    run: vi.fn(),
  };
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb };
});

const mockDb = db as unknown as {
  prepare: Mock;
  run: Mock;
};

let questionFeedbackRepository: QuestionFeedbackRepository;

describe('QuestionFeedbackRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    questionFeedbackRepository = new QuestionFeedbackRepository(db);
    // Default mock for successful run
    mockDb.run.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 50 });
  });

  describe('create', () => {
    const validInput: QuestionFeedbackInput = {
      quiz_id: 101,
      user_id: 202,
      is_good: true,
      user_answer: 'B',
      is_correct: false,
    };

    it('should insert feedback with valid data and return lastInsertRowid', () => {
      const expectedRowId = 50;
      const result = questionFeedbackRepository.create(validInput);

      expect(result).toBe(expectedRowId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO question_feedback (quiz_id, user_id, is_good, user_answer, is_correct) VALUES (?, ?, ?, ?, ?)'
      );
      expect(mockDb.run).toHaveBeenCalledWith(
        validInput.quiz_id,
        validInput.user_id,
        1, // is_good true -> 1
        validInput.user_answer,
        0 // is_correct false -> 0
      );
    });

    it('should handle optional fields being undefined', () => {
      const minimalInput: QuestionFeedbackInput = {
        quiz_id: 102,
        user_id: 203,
        is_good: false,
        // user_answer omitted
        // is_correct omitted
      };
      questionFeedbackRepository.create(minimalInput);

      expect(mockDb.run).toHaveBeenCalledWith(
        minimalInput.quiz_id,
        minimalInput.user_id,
        0, // is_good false -> 0
        null, // user_answer undefined -> null
        null // is_correct undefined -> null
      );
    });

    it('should throw validation error for invalid input data', () => {
      const invalidInput = {
        quiz_id: 'not-a-number',
        user_id: 204,
        is_good: 'yes',
      } as any;
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => questionFeedbackRepository.create(invalidInput)).toThrow(
        /Invalid feedback data:/ // Check for the specific error message prefix
      );
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        '[QuestionFeedbackRepository] Invalid input data for create:',
        expect.anything() // Zod error object
      );
      errorSpy.mockRestore();
    });

    it('should throw database error if insert fails', () => {
      const dbError = new Error('DB Insert Failed');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => questionFeedbackRepository.create(validInput)).toThrow(dbError);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.run).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '[QuestionFeedbackRepository] Error creating question feedback:',
        dbError
      );
      errorSpy.mockRestore();
    });
  });
});
