import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession } from 'next-auth/next';
import { getAuthenticatedSessionUser, SessionUserSchema } from './authUtils';

// Mock next-auth/next
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions (assuming it's just an object, adjust if needed)
vi.mock('@/lib/authOptions', () => ({
  authOptions: { someConfig: 'value' },
}));

describe('Auth Utility Functions', () => {
  const mockGetServerSession = getServerSession as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('getAuthenticatedSessionUser', () => {
    it('returns the session user when valid', async () => {
      const user = { dbId: 456, name: 'User' };
      mockGetServerSession.mockResolvedValue({ user });
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toEqual(SessionUserSchema.parse(user));
    });

    it('returns null when dbId is missing', async () => {
      mockGetServerSession.mockResolvedValue({ user: { name: 'NoId' } });
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
    });

    it('returns null when user is missing', async () => {
      mockGetServerSession.mockResolvedValue({});
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
    });

    it('returns null when session is null', async () => {
      mockGetServerSession.mockResolvedValue(null);
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
    });

    it('throws if getServerSession throws', async () => {
      mockGetServerSession.mockRejectedValue(new Error('fail'));
      await expect(getAuthenticatedSessionUser()).rejects.toThrow('fail');
    });
  });
});
