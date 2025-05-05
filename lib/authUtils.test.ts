import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from 'next-auth';
import { getDbUserIdFromSession } from './authUtils'; // Assuming authUtils.ts is in the same directory

// Use vi.hoisted to ensure mockDb is defined before the mock factory runs
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      prepare: vi.fn(),
      get: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  default: mockDb,
}));

// Mock console methods to prevent test output pollution and allow assertions
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('getDbUserIdFromSession', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Default mock implementation for prepare().get()
    mockDb.prepare.mockReturnValue(mockDb); // Chainable
    mockDb.get.mockReturnValue(undefined); // Default to user not found
  });

  it('should return the user ID when a valid session with a matching user is provided', () => {
    const session: Session = {
      user: { id: 'provider123', provider: 'github', name: 'Test User', email: 'test@example.com' },
      expires: 'some-date',
    };
    const expectedUserId = 1;
    mockDb.get.mockReturnValue({ id: expectedUserId });

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBe(expectedUserId);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(session.user.id, session.user.provider);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null if the session is null', () => {
    const userId = getDbUserIdFromSession(null);
    expect(userId).toBeNull();
    expect(mockDb.prepare).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled(); // No warning for null session
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if session user id is missing', () => {
    const session = {
      // Cast to any to simulate missing id for this specific test
      user: { provider: 'github', name: 'Test User', email: 'test@example.com' } as any,
      expires: 'some-date',
    } as Session;
    const userId = getDbUserIdFromSession(session);
    expect(userId).toBeNull();
    expect(mockDb.prepare).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missing session.user.id'));
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if session user provider is missing', () => {
    // Cast to any to allow missing provider for this test
    const session = {
      user: { id: 'provider123', name: 'Test User', email: 'test@example.com' } as any,
      expires: 'some-date',
    } as Session;

    const userId = getDbUserIdFromSession(session);
    expect(userId).toBeNull();
    expect(mockDb.prepare).not.toHaveBeenCalled();
    // Update assertion to match the actual warning message logged by the function
    expect(console.warn).toHaveBeenCalledWith(
      `[getDbUserIdFromSession] Cannot perform direct lookup: Missing session.user.id (${session.user.id}) or session.user.provider (${session.user.provider})`
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if the user is not found in the database', () => {
    const session: Session = {
      user: { id: 'provider456', provider: 'google', name: 'Test User', email: 'test@example.com' },
      expires: 'some-date',
    };
    // mockDb.get is already configured to return undefined by default in beforeEach
    // mockDb.get.mockReturnValue(undefined);

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(session.user.id, session.user.provider);
    expect(console.warn).toHaveBeenCalledWith(
      `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if the database returns an unexpected structure', () => {
    const session: Session = {
      user: {
        id: 'provider789',
        provider: 'facebook',
        name: 'Test User',
        email: 'test@example.com',
      },
      expires: 'some-date',
    };
    mockDb.get.mockReturnValue({ userId: 5 }); // Incorrect structure

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(session.user.id, session.user.provider);
    expect(console.warn).toHaveBeenCalledWith(
      `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if the database returns an object with id of wrong type', () => {
    const session: Session = {
      user: {
        id: 'providerABC',
        provider: 'twitter',
        name: 'Test User',
        email: 'test@example.com',
      },
      expires: 'some-date',
    };
    mockDb.get.mockReturnValue({ id: 'not-a-number' }); // Incorrect id type

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(session.user.id, session.user.provider);
    expect(console.warn).toHaveBeenCalledWith(
      `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log an error if the database query throws an error', () => {
    const session: Session = {
      user: {
        id: 'providerXYZ',
        provider: 'linkedin',
        name: 'Test User',
        email: 'test@example.com',
      },
      expires: 'some-date',
    };
    const dbError = new Error('Database connection failed');
    mockDb.get.mockImplementation(() => {
      throw dbError;
    });

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(session.user.id, session.user.provider);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      '[getDbUserIdFromSession] Direct lookup DB error:',
      dbError
    );
  });
});
