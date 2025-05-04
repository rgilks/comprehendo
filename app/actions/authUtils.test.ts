import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { getServerSession } from 'next-auth/next';
import { getAuthenticatedUserId, getAuthenticatedSessionUser } from './authUtils';

// Mock next-auth/next
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions (assuming it's just an object, adjust if needed)
vi.mock('@/lib/authOptions', () => ({
  authOptions: { someConfig: 'value' },
}));

// Define a type for the mock session user for clarity
interface MockSessionUser {
  dbId?: number;
  name?: string;
  email?: string;
}

describe('Auth Utility Functions', () => {
  // Cast the mock function to the correct type for TypeScript
  const mockGetServerSession = getServerSession as Mock;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('getAuthenticatedUserId', () => {
    it('should return the user ID when session and dbId exist', async () => {
      const mockSession = { user: { dbId: 123 } };
      mockGetServerSession.mockResolvedValue(mockSession);
      const userId = await getAuthenticatedUserId();
      expect(userId).toBe(123);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session exists but dbId is missing', async () => {
      const mockSession = { user: { name: 'Test User' } }; // No dbId
      mockGetServerSession.mockResolvedValue(mockSession);
      const userId = await getAuthenticatedUserId();
      expect(userId).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session exists but user is missing', async () => {
      const mockSession = {}; // No user
      mockGetServerSession.mockResolvedValue(mockSession);
      const userId = await getAuthenticatedUserId();
      expect(userId).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session does not exist', async () => {
      mockGetServerSession.mockResolvedValue(null);
      const userId = await getAuthenticatedUserId();
      expect(userId).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null if getServerSession throws an error', async () => {
      const error = new Error('Session fetch failed');
      mockGetServerSession.mockRejectedValue(error);
      await expect(getAuthenticatedUserId()).rejects.toThrow('Session fetch failed');
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAuthenticatedSessionUser', () => {
    it('should return the session user object when session and dbId exist', async () => {
      const mockUser: MockSessionUser = { dbId: 456, name: 'Another User' };
      const mockSession = { user: mockUser };
      mockGetServerSession.mockResolvedValue(mockSession);
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toEqual(mockUser);
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session exists but dbId is missing', async () => {
      const mockUser: MockSessionUser = { name: 'User Without ID' };
      const mockSession = { user: mockUser };
      mockGetServerSession.mockResolvedValue(mockSession);
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session exists but user object is missing', async () => {
      const mockSession = {}; // No user object
      mockGetServerSession.mockResolvedValue(mockSession);
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null when session does not exist', async () => {
      mockGetServerSession.mockResolvedValue(null);
      const sessionUser = await getAuthenticatedSessionUser();
      expect(sessionUser).toBeNull();
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });

    it('should return null if getServerSession throws an error', async () => {
      const error = new Error('Session fetch failed');
      mockGetServerSession.mockRejectedValue(error);
      await expect(getAuthenticatedSessionUser()).rejects.toThrow('Session fetch failed');
      expect(mockGetServerSession).toHaveBeenCalledTimes(1);
    });
  });
});
