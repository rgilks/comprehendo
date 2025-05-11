import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { type Account, type User } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';
import { upsertUserOnSignIn, findUserByProvider, findUserIdByProvider } from './userRepository';
import db from '../db'; // Import the actual db to mock it

// Mock the db dependency
vi.mock('../db', () => {
  const mockDb = {
    prepare: vi.fn(),
    run: vi.fn(),
    get: vi.fn(),
  };
  // Make prepare chainable
  mockDb.prepare.mockImplementation(() => mockDb);
  return { default: mockDb };
});

// Cast the mocked db for easier use
const mockDb = db as unknown as {
  prepare: Mock;
  get: Mock;
  run: Mock;
};

// Mock console methods
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('userRepository', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
    consoleLogSpy.mockClear();

    // Reset mock implementations
    mockDb.prepare.mockClear().mockImplementation(() => mockDb); // Ensure chaining is reset
    mockDb.get.mockClear();
    mockDb.run.mockClear();
  });

  afterEach(() => {
    // No need to restore here if we clear in beforeEach
    // consoleWarnSpy.mockRestore();
    // consoleErrorSpy.mockRestore();
    // consoleLogSpy.mockRestore();
  });

  describe('upsertUserOnSignIn', () => {
    const mockUser: User = {
      id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      image: 'http://example.com/image.jpg',
    };
    const mockAdapterUser: AdapterUser = {
      id: 'adapterUser456',
      email: 'adapter@example.com',
      emailVerified: null,
    };
    const mockAccount: Account = {
      provider: 'google',
      type: 'oauth',
      providerAccountId: 'acc123',
      access_token: 'token',
      token_type: 'bearer',
      scope: 'email profile',
    };
    const DEFAULT_LANGUAGE = 'en';

    it('should call db.prepare with the correct SQL and parameters for a new user', () => {
      upsertUserOnSignIn(mockUser, mockAccount);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
      expect(mockDb.run).toHaveBeenCalledWith(
        mockUser.id,
        mockAccount.provider,
        mockUser.name,
        mockUser.email,
        mockUser.image,
        DEFAULT_LANGUAGE,
        mockUser.name,
        mockUser.email,
        mockUser.image
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `[UserRepository] Upserted user for provider ${mockAccount.provider}, id ${mockUser.id}`
      );
    });

    it('should handle null values for name, email, and image', () => {
      const userWithNulls: User = { id: 'user789', email: 'nonull@example.com' };
      upsertUserOnSignIn(userWithNulls, mockAccount);

      expect(mockDb.run).toHaveBeenCalledWith(
        userWithNulls.id,
        mockAccount.provider,
        null,
        userWithNulls.email,
        null,
        DEFAULT_LANGUAGE,
        null,
        userWithNulls.email,
        null
      );
    });

    it('should work with AdapterUser type', () => {
      upsertUserOnSignIn(mockAdapterUser, mockAccount);
      expect(mockDb.run).toHaveBeenCalledWith(
        mockAdapterUser.id,
        mockAccount.provider,
        null, // AdapterUser has no name
        mockAdapterUser.email,
        null, // AdapterUser has no image
        DEFAULT_LANGUAGE,
        null,
        mockAdapterUser.email,
        null
      );
    });

    it('should log a warning and return if user id is missing', () => {
      const userWithoutId: Partial<User> = { email: 'test@example.com' };
      upsertUserOnSignIn(userWithoutId as User, mockAccount);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[UserRepository] Missing user id or email for provider ${mockAccount.provider}. Skipping DB upsert.`
      );
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('should log a warning and return if user email is missing', () => {
      const userWithoutEmail: Partial<User> = { id: 'user123' };
      upsertUserOnSignIn(userWithoutEmail as User, mockAccount);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[UserRepository] Missing user id or email for provider ${mockAccount.provider}. Skipping DB upsert.`
      );
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('should catch and re-throw database errors', () => {
      const dbError = new Error('DB Connection Failed');
      mockDb.run.mockImplementationOnce(() => {
        throw dbError;
      });

      expect(() => {
        upsertUserOnSignIn(mockUser, mockAccount);
      }).toThrow(`Failed to upsert user: ${dbError.message}`);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[UserRepository] Error upserting user data:',
        dbError
      );
    });
  });

  describe('findUserByProvider', () => {
    const providerId = 'prov123';
    const provider = 'google';

    it('should return user id if user exists', () => {
      const expectedUserId = 12345;
      mockDb.get.mockReturnValue({ id: expectedUserId });

      const result = findUserByProvider(providerId, provider);

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
      );
      expect(mockDb.get).toHaveBeenCalledWith(providerId, provider);
      expect(result).toEqual({ id: expectedUserId });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return null if user does not exist', () => {
      mockDb.get.mockReturnValue(undefined);

      const result = findUserByProvider(providerId, provider);

      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(providerId, provider); // Ensure get was still called
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return null and log error if user record has invalid structure', () => {
      const invalidRecord = { someOtherField: 'value' };
      mockDb.get.mockReturnValue(invalidRecord);

      const result = findUserByProvider(providerId, provider);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[UserRepository] Found user record for ${provider}/${providerId} but structure is invalid:`,
        invalidRecord
      );
    });

    it('should catch and re-throw database errors', () => {
      const dbError = new Error('DB Query Failed');
      mockDb.get.mockImplementationOnce(() => {
        throw dbError;
      });

      expect(() => findUserByProvider(providerId, provider)).toThrow(
        `Failed to find user by provider: ${dbError.message}`
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[UserRepository] DB error fetching user ID:',
        dbError
      );
    });
  });

  describe('findUserIdByProvider', () => {
    const providerId = 'userPId123';
    const provider = 'test_provider';

    it('should return user id if user is found', () => {
      const expectedId = 789;
      mockDb.get.mockReturnValue({ id: expectedId });

      const result = findUserIdByProvider(providerId, provider);

      expect(result).toBe(expectedId);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
      );
      expect(mockDb.get).toHaveBeenCalledWith(providerId, provider);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return undefined if user is not found', () => {
      mockDb.get.mockReturnValue(undefined);

      const result = findUserIdByProvider(providerId, provider);

      expect(result).toBeUndefined();
      expect(mockDb.get).toHaveBeenCalledWith(providerId, provider);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return undefined and log error if database query fails', () => {
      const dbError = new Error('DB Get Crashed');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });

      const result = findUserIdByProvider(providerId, provider);

      expect(result).toBeUndefined();
      expect(mockDb.prepare).toHaveBeenCalledTimes(1); // Ensure prepare was called before the error
      expect(mockDb.get).toHaveBeenCalledWith(providerId, provider);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[UserRepo] Error finding user ID by provider:',
        dbError
      );
    });
  });
});
