import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

vi.mock('app/repo/userRepo', () => ({
  findUserIdByProvider: vi.fn(),
}));

vi.mock('app/repo/quizRepo', () => ({
  getRandomGoodQuestion: vi.fn(),
}));

describe('exercise actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRandomGoodQuestionResponse', () => {
    it('should handle invalid request parameters', async () => {
      const { getRandomGoodQuestionResponse } = await import('app/actions/exercise');
      const { getServerSession } = await import('next-auth');
      const { headers } = await import('next/headers');

      vi.mocked(getServerSession).mockResolvedValue(null);
      vi.mocked(headers).mockResolvedValue(new Headers());

      const result = await getRandomGoodQuestionResponse({
        invalidParam: 'test',
      });

      expect(result.error).toContain('Invalid request parameters');
      expect(result.quizId).toBe(-1);
    });

    it('should handle errors gracefully', async () => {
      const { getRandomGoodQuestion } = await import('app/repo/quizRepo');

      // Mock getRandomGoodQuestion to throw an error
      vi.mocked(getRandomGoodQuestion).mockImplementation(() => {
        throw new Error('Database error');
      });

      const { getRandomGoodQuestionResponse } = await import('app/actions/exercise');
      const { getServerSession } = await import('next-auth');
      const { headers } = await import('next/headers');
      const { findUserIdByProvider } = await import('app/repo/userRepo');

      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: '123', provider: 'google' },
      } as never);
      vi.mocked(headers).mockResolvedValue(new Headers());
      vi.mocked(findUserIdByProvider).mockResolvedValue(1);

      const result = await getRandomGoodQuestionResponse({
        passageLanguage: 'es',
        questionLanguage: 'en',
        cefrLevel: 'A1',
      });

      expect(result.error).toContain('Database error');
      expect(result.quizId).toBe(-1);
    });
  });
});
