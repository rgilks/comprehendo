import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('app/lib/db', () => ({
  default: vi.fn(),
  getDb: vi.fn(),
  schema: {
    quiz: {
      id: 'id',
      language: 'language',
      level: 'level',
      content: 'content',
      createdAt: 'createdAt',
      questionLanguage: 'questionLanguage',
      userId: 'userId',
    },
    questionFeedback: {
      id: 'id',
      quizId: 'quizId',
      userId: 'userId',
      isGood: 'isGood',
      submittedAt: 'submittedAt',
    },
  },
}));

describe('quizRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRandomGoodQuestion', () => {
    it('should handle database errors gracefully', async () => {
      const { getRandomGoodQuestion } = await import('app/repo/quizRepo');
      const { getDb } = await import('app/lib/db');

      // Mock database error
      vi.mocked(getDb).mockRejectedValue(new Error('Database error'));

      const result = await getRandomGoodQuestion('es', 'en', 'A1', 1, null);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no good questions found', async () => {
      const { getRandomGoodQuestion } = await import('app/repo/quizRepo');
      const { getDb } = await import('app/lib/db');

      // Mock empty result
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(getDb).mockResolvedValue(mockDb as unknown);

      const result = await getRandomGoodQuestion('es', 'en', 'A1', 1, null);

      expect(result).toBeUndefined();
    });
  });
});
