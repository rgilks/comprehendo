import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import the functions to test
import {
  getCachedExercise,
  saveExerciseToCache,
  countCachedExercises,
  getValidatedExerciseFromCache,
  type QuizRow,
} from './exercise-cache';
import { QuizDataSchema } from '@/lib/domain/schemas';
import { LanguageSchema } from '@/lib/domain/language';
import { CEFRLevelSchema } from '@/lib/domain/language-guidance';
import { z } from 'zod';

// Import the manual mock instance for the database
import mockDb from './__mocks__/db';
vi.mock('@/lib/db'); // Use the manual mock

// Keep the schema mock
vi.mock('@/lib/domain/schemas', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/domain/schemas')>();
  return {
    ...actual,
    QuizDataSchema: {
      safeParse: vi.fn(),
    },
  };
});
const mockQuizDataSafeParse = vi.mocked(QuizDataSchema.safeParse);

describe('Exercise Cache Functions', () => {
  const passageLanguage = LanguageSchema.parse('en');
  const questionLanguage = LanguageSchema.parse('es');
  const level = CEFRLevelSchema.parse('B1');
  const userId = 1;
  const anonUserId = null;
  const mockValidQuizData = {
    paragraph: 'Test Paragraph',
    question: 'Test Question?',
    options: { A: 'Opt A', B: 'Opt B', C: 'Opt C', D: 'Opt D' },
    topic: 'Test Topic',
    correctAnswer: 'A',
    allExplanations: { A: 'Expl A', B: 'Expl B', C: 'Expl C', D: 'Expl D' },
    relevantText: 'Relevant Text',
  };
  const jsonContent = JSON.stringify(mockValidQuizData);
  const mockQuizRow: QuizRow = {
    id: 123,
    language: passageLanguage,
    level: level,
    content: jsonContent,
    created_at: new Date().toISOString(),
    question_language: questionLanguage,
  };

  beforeEach(() => {
    // Reset all general mocks
    vi.resetAllMocks();
    // Reset specific mocks
    mockQuizDataSafeParse.mockClear();
    mockDb.prepare.mockClear().mockReturnThis();
    mockDb.get.mockClear();
    mockDb.run.mockClear();

    // Configure default successful validation for QuizDataSchema
    mockQuizDataSafeParse.mockImplementation((data: unknown) => {
      if (typeof data === 'object' && data !== null && 'paragraph' in data) {
        return { success: true, data: data as any };
      }
      const mockError = new z.ZodError([]);
      vi.spyOn(mockError, 'format').mockReturnValue('mock validation error' as any);
      return { success: false, error: mockError };
    });

    // Default DB mock behavior (used by getCachedExercise internally)
    mockDb.get.mockReturnValue(undefined); // Default to cache miss
  });

  describe('getCachedExercise', () => {
    it('should return a quiz row for a logged-in user when found', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);
      expect(result).toEqual(mockQuizRow);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(userId, passageLanguage, questionLanguage, level);
    });

    it('should return undefined for a logged-in user when not found', () => {
      // Default mockDb.get returns undefined
      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);
      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(userId, passageLanguage, questionLanguage, level);
    });

    it('should return a quiz row for an anonymous user when found', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      const result = getCachedExercise(passageLanguage, questionLanguage, level, anonUserId);
      expect(result).toEqual(mockQuizRow);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return undefined for an anonymous user when not found', () => {
      // Default mockDb.get returns undefined
      const result = getCachedExercise(passageLanguage, questionLanguage, level, anonUserId);
      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return undefined on database error', () => {
      const dbError = new Error('DB Select Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getCachedExercise(passageLanguage, questionLanguage, level, userId);

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error getting cached exercise:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('saveExerciseToCache', () => {
    it('should return the new quiz ID on successful insert', () => {
      const expectedId = 456;
      mockDb.get.mockReturnValue({ id: expectedId }); // Mock the RETURNING id part

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBe(expectedId);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(mockDb.get).toHaveBeenCalledWith(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );
    });

    it('should handle null userId correctly during insert', () => {
      const expectedId = 789;
      mockDb.get.mockReturnValue({ id: expectedId });

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        anonUserId
      );

      expect(result).toBe(expectedId);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(mockDb.get).toHaveBeenCalledWith(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        null
      ); // Ensure null is passed
    });

    it('should return undefined if insert fails to return an ID', () => {
      mockDb.get.mockReturnValue(undefined); // Simulate insert failing silently or RETURNING not working
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get ID after saving to cache')
      );
      errorSpy.mockRestore();
    });

    it('should return undefined on database error', () => {
      const dbError = new Error('DB Insert Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      }); // Make the .get() after prepare throw
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO quiz'));
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error saving exercise to cache:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('countCachedExercises', () => {
    it('should return the count when found', () => {
      const expectedCount = 5;
      mockDb.get.mockReturnValue({ count: expectedCount });

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(expectedCount);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return 0 if no count is found', () => {
      mockDb.get.mockReturnValue(undefined); // Simulate no row returned

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(0);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*)'));
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
    });

    it('should return 0 on database error', () => {
      const dbError = new Error('DB Count Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = countCachedExercises(passageLanguage, questionLanguage, level);

      expect(result).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error counting cached exercises:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('getValidatedExerciseFromCache', () => {
    const expectedPartialData = {
      paragraph: mockValidQuizData.paragraph,
      question: mockValidQuizData.question,
      options: mockValidQuizData.options,
      topic: mockValidQuizData.topic,
    };
    const expectedResult = {
      quizData: expectedPartialData,
      quizId: mockQuizRow.id,
    };

    it('should return validated partial data when cache hit and data is valid', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      mockQuizDataSafeParse.mockReturnValue({ success: true, data: mockValidQuizData } as any);

      const result = getValidatedExerciseFromCache(
        passageLanguage,
        questionLanguage,
        level,
        userId
      );

      expect(result).toEqual(expectedResult);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledWith(userId, passageLanguage, questionLanguage, level);
      expect(mockQuizDataSafeParse).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).toHaveBeenCalledWith(mockValidQuizData);
    });

    it('should return validated partial data for anonymous user', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      mockQuizDataSafeParse.mockReturnValue({ success: true, data: mockValidQuizData } as any);

      const result = getValidatedExerciseFromCache(passageLanguage, questionLanguage, level, null);

      expect(result).toEqual(expectedResult);
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockDb.get).toHaveBeenCalledWith(passageLanguage, questionLanguage, level);
      expect(mockQuizDataSafeParse).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).toHaveBeenCalledWith(mockValidQuizData);
    });

    it('should return undefined if getCachedExercise returns undefined (cache miss)', () => {
      mockDb.get.mockReturnValue(undefined);

      const result = getValidatedExerciseFromCache(
        passageLanguage,
        questionLanguage,
        level,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).not.toHaveBeenCalled();
    });

    it('should return undefined and log error if JSON parsing fails', () => {
      const invalidJsonRow = { ...mockQuizRow, content: 'invalid json' };
      mockDb.get.mockReturnValue(invalidJsonRow);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getValidatedExerciseFromCache(
        passageLanguage,
        questionLanguage,
        level,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache:getValidated] Error processing cached exercise ID'),
        mockQuizRow.id,
        ':',
        expect.any(SyntaxError)
      );
      errorSpy.mockRestore();
    });

    it('should return undefined and log error if QuizData validation fails', () => {
      mockDb.get.mockReturnValue(mockQuizRow);
      const mockZodError = new z.ZodError([]);
      vi.spyOn(mockZodError, 'format').mockReturnValue('Invalid QuizData' as any);
      const validationError = { success: false, error: mockZodError };
      mockQuizDataSafeParse.mockReturnValue(validationError as any);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getValidatedExerciseFromCache(
        passageLanguage,
        questionLanguage,
        level,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).toHaveBeenCalledTimes(1);
      expect(mockQuizDataSafeParse).toHaveBeenCalledWith(mockValidQuizData);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Cache:getValidated] Invalid data found in cache for ID'),
        mockQuizRow.id,
        ':',
        'Invalid QuizData'
      );
      errorSpy.mockRestore();
    });

    it('should return undefined if the underlying DB call in getCachedExercise fails', () => {
      const dbError = new Error('DB Select Failed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = getValidatedExerciseFromCache(
        passageLanguage,
        questionLanguage,
        level,
        userId
      );

      expect(result).toBeUndefined();
      expect(mockDb.get).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('[Cache] Error getting cached exercise:', dbError);
      expect(mockQuizDataSafeParse).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
