/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database
vi.mock('app/repo/db', () => ({
  default: {
    prepare: vi.fn(),
  },
}));

describe('quizRepo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRandomGoodQuestion', () => {
    it('should handle database errors gracefully', async () => {
      const { getRandomGoodQuestion } = await import('app/repo/quizRepo');
      const { default: mockDb } = await import('app/repo/db');

      // Mock database error
      const mockPrepare = vi.mocked(mockDb.prepare);
      mockPrepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = getRandomGoodQuestion('es', 'en', 'A1', 1);

      expect(result).toBeUndefined();
    });

    it('should return undefined when no good questions found', async () => {
      const { getRandomGoodQuestion } = await import('app/repo/quizRepo');
      const { default: mockDb } = await import('app/repo/db');

      const mockStmt = {
        get: vi.fn().mockReturnValue(undefined),
      } as never;

      const mockPrepare = vi.mocked(mockDb.prepare);
      mockPrepare.mockReturnValue(mockStmt);

      const result = getRandomGoodQuestion('es', 'en', 'A1', 1);

      expect(result).toBeUndefined();
    });
  });
});
