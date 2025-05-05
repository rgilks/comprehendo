import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Account, type User } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';
import { upsertUserOnSignIn, findUserByProvider } from './userRepository';
import db from '../db'; // Import the actual db to spy on its methods

// Mock the db dependency structure
vi.mock('../db', async (importOriginal) => {
  const actualDb = await importOriginal<typeof import('../db')>();
  return {
    ...actualDb,
    default: {
      prepare: vi.fn(() => ({
        // Mock prepare to return an object
        run: vi.fn(), // with mockable run
        get: vi.fn(), // and get methods
      })),
    },
  };
});

// Define variables to hold the spy objects for run/get
let mockRun: ReturnType<typeof vi.fn>;
let mockGet: ReturnType<typeof vi.fn>;

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

    // Create the mock statement object with mockable run/get methods
    const mockStatement = {
      run: vi.fn(),
      get: vi.fn(),
    };

    // Assign the spies to our variables for use in expect() calls
    mockRun = mockStatement.run;
    mockGet = mockStatement.get;

    // Ensure every call to db.prepare returns our mockStatement
    (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue(mockStatement);
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

      expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO users'));
      expect(mockRun).toHaveBeenCalledWith(
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

      expect(mockRun).toHaveBeenCalledWith(
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
      expect(mockRun).toHaveBeenCalledWith(
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
      expect(db.prepare).not.toHaveBeenCalled();
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('should log a warning and return if user email is missing', () => {
      const userWithoutEmail: Partial<User> = { id: 'user123' };
      upsertUserOnSignIn(userWithoutEmail as User, mockAccount);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `[UserRepository] Missing user id or email for provider ${mockAccount.provider}. Skipping DB upsert.`
      );
      expect(db.prepare).not.toHaveBeenCalled();
      expect(mockRun).not.toHaveBeenCalled();
    });

    it('should catch and re-throw database errors', () => {
      const dbError = new Error('DB Connection Failed');
      mockRun.mockImplementationOnce(() => {
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
      mockGet.mockReturnValue({ id: expectedUserId });

      const result = findUserByProvider(providerId, provider);

      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE provider_id = ? AND provider = ?'
      );
      expect(mockGet).toHaveBeenCalledWith(providerId, provider);
      expect(result).toEqual({ id: expectedUserId });
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return null if user does not exist', () => {
      mockGet.mockReturnValue(undefined);

      const result = findUserByProvider(providerId, provider);

      expect(result).toBeNull();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return null and log error if user record has invalid structure', () => {
      const invalidRecord = { someOtherField: 'value' };
      mockGet.mockReturnValue(invalidRecord);

      const result = findUserByProvider(providerId, provider);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `[UserRepository] Found user record for ${provider}/${providerId} but structure is invalid:`,
        invalidRecord
      );
    });

    it('should catch and re-throw database errors', () => {
      const dbError = new Error('DB Query Failed');
      mockGet.mockImplementationOnce(() => {
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
});
