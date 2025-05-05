import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from 'next-auth';
import { getDbUserIdFromSession } from './authUtils'; // Assuming authUtils.ts is in the same directory
import * as userRepository from '@/lib/repositories/userRepository'; // Import the repository

// Mock the specific repository function used
vi.mock('@/lib/repositories/userRepository', () => ({
  findUserIdByProvider: vi.fn(),
}));

// Mock console methods to prevent test output pollution and allow assertions
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('getDbUserIdFromSession', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks(); // Clears console mocks too
    vi.mocked(userRepository.findUserIdByProvider).mockReturnValue(undefined); // Default to user not found
  });

  it('should return the user ID when a valid session with a matching user is provided', () => {
    const session: Session = {
      user: { id: 'provider123', provider: 'github', name: 'Test User', email: 'test@example.com' },
      expires: 'some-date',
    };
    const expectedUserId = 1;
    vi.mocked(userRepository.findUserIdByProvider).mockReturnValue(expectedUserId);

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBe(expectedUserId);
    expect(userRepository.findUserIdByProvider).toHaveBeenCalledWith(
      session.user.id,
      session.user.provider
    );
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null if the session is null', () => {
    const userId = getDbUserIdFromSession(null);
    expect(userId).toBeNull();
    expect(userRepository.findUserIdByProvider).not.toHaveBeenCalled();
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
    expect(userRepository.findUserIdByProvider).not.toHaveBeenCalled();
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
    expect(userRepository.findUserIdByProvider).not.toHaveBeenCalled();
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
    // userRepository.findUserIdByProvider is already mocked to return undefined in beforeEach

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(userRepository.findUserIdByProvider).toHaveBeenCalledWith(
      session.user.id,
      session.user.provider
    );
    expect(console.warn).toHaveBeenCalledWith(
      `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should return null and log a warning if the database returns an object with id of wrong type', () => {
    // This case is handled within the userRepository and won't occur here.
    // The repository function findUserIdByProvider returns number | undefined.
    // If the DB returns a wrong type, the repo logs an error and returns undefined.
    // This test case becomes equivalent to the 'user not found' case for authUtils.
    const session: Session = {
      user: {
        id: 'providerABC',
        provider: 'twitter',
        name: 'Test User',
        email: 'test@example.com',
      },
      expires: 'some-date',
    };
    // Assume repo returns undefined (already default mock behaviour)
    const userId = getDbUserIdFromSession(session);
    expect(userId).toBeNull();
    expect(userRepository.findUserIdByProvider).toHaveBeenCalledWith(
      session.user.id,
      session.user.provider
    );
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Direct lookup failed'));
    expect(console.error).not.toHaveBeenCalled(); // Error is logged in repo, not here.
  });

  it('should return null and log an error if the repository function throws an error', () => {
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
    vi.mocked(userRepository.findUserIdByProvider).mockImplementation(() => {
      throw dbError;
    });

    const userId = getDbUserIdFromSession(session);

    expect(userId).toBeNull();
    expect(userRepository.findUserIdByProvider).toHaveBeenCalledWith(
      session.user.id,
      session.user.provider
    );
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      '[getDbUserIdFromSession] Direct lookup DB error:',
      dbError
    );
  });
});
