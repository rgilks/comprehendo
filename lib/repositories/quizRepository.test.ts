import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import db from '@/lib/db'; // Mock this
import {
  type Quiz,
  findQuizById,
  createQuiz,
  findSuitableQuizForUser,
  saveExercise,
  countExercises,
} from './quizRepository';

// Mock the db dependency
vi.mock('@/lib/db', () => {
  const mockDb = {
    prepare: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb };
});

const mockDb = db as unknown as {
  prepare: Mock;
  get: Mock;
  run: Mock;
};

// Sample data for testing
const mockQuizContent = {
  paragraph: 'Questo è il testo del paragrafo.',
  question: 'Qual è la domanda?',
  options: { A: 'Opzione A', B: 'Opzione B', C: 'Opzione C', D: 'Opzione D' },
  correctAnswer: 'B',
  allExplanations: {
    A: 'Spiegazione A',
    B: 'Spiegazione B',
    C: 'Spiegazione C',
    D: 'Spiegazione D',
  },
  topic: 'Test Topic',
  relevantText: 'Testo rilevante.',
};
const mockQuizContentString = JSON.stringify(mockQuizContent);

const mockDbRow = {
  id: 1,
  language: 'fr',
  level: 'A1',
  content: mockQuizContentString,
  created_at: new Date().toISOString(),
  question_language: 'en',
  user_id: 10,
};

const expectedParsedQuiz: Quiz = {
  ...mockDbRow,
  content: mockQuizContent,
};

describe('QuizRepository Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockDb.get.mockReset().mockReturnValue(undefined);
    mockDb.run.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 99 });
  });

  describe('findQuizById', () => {
    it('should return a parsed quiz if found and valid', () => {
      mockDb.get.mockReturnValue(mockDbRow);
      const result = findQuizById(1);
      expect(result).toEqual(expectedParsedQuiz);
      expect(mockDb.prepare).toHaveBeenCalledWith('SELECT * FROM quiz WHERE id = ?');
      expect(mockDb.get).toHaveBeenCalledWith(1);
    });

    it('should return null if quiz is not found', () => {
      mockDb.get.mockReturnValue(undefined);
      const result = findQuizById(2);
      expect(result).toBeNull();
    });

    it('should return null if quiz row structure is invalid', () => {
      const invalidRow = { ...mockDbRow, language: null }; // Invalid structure
      mockDb.get.mockReturnValue(invalidRow);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = findQuizById(1);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid quiz row structure'),
        expect.anything()
      );
      errorSpy.mockRestore();
    });

    it('should return null if quiz content JSON is invalid', () => {
      const rowWithBadJson = { ...mockDbRow, content: "{'invalid json" };
      mockDb.get.mockReturnValue(rowWithBadJson);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = findQuizById(1);
      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse quiz content JSON'),
        expect.any(SyntaxError)
      );
      errorSpy.mockRestore();
    });

    it('should throw error if database query fails', () => {
      const dbError = new Error('DB Get Error');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => findQuizById(1)).toThrow(dbError);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching quiz by ID'),
        dbError
      );
      errorSpy.mockRestore();
    });
  });

  describe('createQuiz', () => {
    it('should insert a new quiz and return the last insert row ID', () => {
      const lang = 'es';
      const level = 'B1';
      const qLang = 'en';
      const userId = 20;
      const expectedRowId = 99;

      const result = createQuiz(lang, level, qLang, mockQuizContent, userId);

      expect(result).toBe(expectedRowId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO quiz (language, level, question_language, content, user_id) VALUES (?, ?, ?, ?, ?)'
      );
      expect(mockDb.run).toHaveBeenCalledWith(lang, level, qLang, mockQuizContentString, userId);
    });

    it('should handle null questionLanguage and userId', () => {
      createQuiz('de', 'C1', null, mockQuizContent, null);
      expect(mockDb.run).toHaveBeenCalledWith(
        'de',
        'C1',
        null, // questionLanguage
        mockQuizContentString,
        null // userId
      );
    });

    it('should throw error if JSON stringify fails', () => {
      const circularContent: any = {};
      circularContent.self = circularContent; // Create circular reference
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => createQuiz('it', 'A2', 'en', circularContent)).toThrow();
      expect(errorSpy).toHaveBeenCalledWith(
        '[QuizRepository] Error creating quiz:',
        expect.any(Error)
      );
      expect(mockDb.prepare).not.toHaveBeenCalled(); // Prepare shouldn't be called if stringify fails
      errorSpy.mockRestore();
    });

    it('should throw error if database insert fails', () => {
      const dbError = new Error('DB Insert Error');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => createQuiz('ja', 'B2', 'en', mockQuizContent)).toThrow(dbError);
      expect(errorSpy).toHaveBeenCalledWith('[QuizRepository] Error creating quiz:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('findSuitableQuizForUser', () => {
    const pLang = 'fr';
    const qLang = 'en';
    const level = 'A2';
    const userId = 30;

    it('should query with user exclusion if userId is provided', () => {
      mockDb.get.mockReturnValue(mockDbRow);
      const result = findSuitableQuizForUser(pLang, qLang, level, userId);

      expect(result).toEqual(expectedParsedQuiz);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(userId, pLang, qLang, level);
    });

    it('should query without user exclusion if userId is null', () => {
      mockDb.get.mockReturnValue(mockDbRow);
      const result = findSuitableQuizForUser(pLang, qLang, level, null);

      expect(result).toEqual(expectedParsedQuiz);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.not.stringContaining('LEFT JOIN'));
      expect(mockDb.get).toHaveBeenCalledWith(pLang, qLang, level);
    });

    it('should return null if no suitable quiz is found', () => {
      mockDb.get.mockReturnValue(undefined);
      const result = findSuitableQuizForUser(pLang, qLang, level, userId);
      expect(result).toBeNull();
    });

    it('should return null if found row is invalid', () => {
      const invalidRow = { ...mockDbRow, level: null };
      mockDb.get.mockReturnValue(invalidRow);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = findSuitableQuizForUser(pLang, qLang, level, userId);

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid cached quiz row structure'),
        expect.anything()
      );
      errorSpy.mockRestore();
    });

    it('should return null if found content JSON is invalid', () => {
      const rowWithBadJson = { ...mockDbRow, content: 'invalid' };
      mockDb.get.mockReturnValue(rowWithBadJson);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = findSuitableQuizForUser(pLang, qLang, level, userId);

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse cached quiz content JSON'),
        expect.any(SyntaxError)
      );
      errorSpy.mockRestore();
    });

    it('should throw error if database query fails', () => {
      const dbError = new Error('DB Find Error');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => findSuitableQuizForUser(pLang, qLang, level, userId)).toThrow(dbError);
      expect(errorSpy).toHaveBeenCalledWith(
        '[QuizRepository] Error finding suitable quiz:',
        dbError
      );
      errorSpy.mockRestore();
    });
  });

  describe('saveExercise', () => {
    it('should insert a new exercise using content JSON and return the last insert row ID', () => {
      const lang = 'pt';
      const level = 'C1';
      const qLang = 'en';
      const userId = 40;
      const expectedRowId = 99;

      const result = saveExercise(lang, qLang, level, mockQuizContentString, userId);

      expect(result).toBe(expectedRowId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO quiz (language, level, content, question_language, user_id) VALUES (?, ?, ?, ?, ?)'
      );
      expect(mockDb.run).toHaveBeenCalledWith(lang, level, mockQuizContentString, qLang, userId);
    });

    it('should handle null questionLanguage and userId', () => {
      saveExercise('nl', null, 'A1', mockQuizContentString, null);
      expect(mockDb.run).toHaveBeenCalledWith(
        'nl',
        'A1',
        mockQuizContentString,
        null, // questionLanguage
        null // userId
      );
    });

    it('should throw error if database insert fails', () => {
      const dbError = new Error('DB Save Error');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => saveExercise('zh', 'en', 'B2', mockQuizContentString, 50)).toThrow(dbError);
      expect(errorSpy).toHaveBeenCalledWith('[QuizRepository] Error saving exercise:', dbError);
      errorSpy.mockRestore();
    });
  });

  describe('countExercises', () => {
    const pLang = 'de';
    const qLang = 'en';
    const level = 'B1';

    it('should return the count of exercises matching the criteria', () => {
      const expectedCount = 15;
      mockDb.get.mockReturnValue({ count: expectedCount });

      const result = countExercises(pLang, qLang, level);

      expect(result).toBe(expectedCount);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM quiz WHERE language = ? AND question_language = ? AND level = ?'
      );
      expect(mockDb.get).toHaveBeenCalledWith(pLang, qLang, level);
    });

    it('should return 0 if no exercises are found', () => {
      mockDb.get.mockReturnValue(undefined);
      const result = countExercises(pLang, qLang, level);
      expect(result).toBe(0);
    });

    it('should return 0 if count is null or undefined', () => {
      mockDb.get.mockReturnValue({ count: null });
      let result = countExercises(pLang, qLang, level);
      expect(result).toBe(0);

      mockDb.get.mockReturnValue({}); // count property missing
      result = countExercises(pLang, qLang, level);
      expect(result).toBe(0);
    });

    it('should throw error if database query fails', () => {
      const dbError = new Error('DB Count Error');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => countExercises(pLang, qLang, level)).toThrow(dbError);

      expect(errorSpy).toHaveBeenCalledWith('[QuizRepository] Error counting exercises:', dbError);
      errorSpy.mockRestore();
    });
  });
});
