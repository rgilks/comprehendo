import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerSession } from 'next-auth/next';
import { getAuthenticatedSessionUser } from './authUtils';

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/authOptions', () => ({
  authOptions: { someConfig: 'value' },
}));

describe('getAuthenticatedSessionUser', () => {
  const mockGetServerSession = vi.mocked(getServerSession);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user when valid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { dbId: 456, name: 'User' } });
    const sessionUser = await getAuthenticatedSessionUser();
    expect(sessionUser).toEqual({ dbId: 456, name: 'User' });
  });

  it.each([
    [{ user: { name: 'NoId' } }, 'no dbId'],
    [{}, 'no user'],
    [null, 'no session'],
  ])('returns null when %s', async (session, _) => {
    mockGetServerSession.mockResolvedValue(session);
    const sessionUser = await getAuthenticatedSessionUser();
    expect(sessionUser).toBeNull();
  });

  it('throws if getServerSession throws', async () => {
    mockGetServerSession.mockRejectedValue(new Error('fail'));
    await expect(getAuthenticatedSessionUser()).rejects.toThrow('fail');
  });
});
