import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInCallback, jwtCallback, sessionCallback } from './callbacks';
import * as userRepo from '../repositories/userRepository';
import { type Account, type User } from 'next-auth';
import { type JWT } from 'next-auth/jwt';
import { type Session } from 'next-auth';

// Mocks
vi.mock('../repositories/userRepository');
vi.mock('../config/authEnv', () => ({
  validatedAuthEnv: {
    ADMIN_EMAILS: ['admin@example.com'],
  },
}));

const mockUser: User = {
  id: 'provider-user-123',
  name: 'Test User',
  email: 'test@example.com',
  image: 'http://example.com/image.png',
};

const mockUserAdmin: User = {
  id: 'provider-admin-456',
  name: 'Admin User',
  email: 'admin@example.com',
  image: 'http://example.com/admin.png',
};

const mockAccount: Account = {
  provider: 'google',
  type: 'oauth',
  providerAccountId: 'provider-user-123',
  access_token: 'token',
  token_type: 'bearer',
  scope: 'email profile',
};

const mockTokenBase: JWT = {
  name: 'Test User',
  email: 'test@example.com',
  picture: 'http://example.com/image.png',
  sub: 'provider-user-123',
};

const mockSessionBase: Session = {
  user: {
    id: 'provider-user-123',
    name: 'Test User',
    email: 'test@example.com',
    image: 'http://example.com/image.png',
  },
  expires: 'some-future-date',
};

describe('Auth Callbacks', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
  });

  describe('signInCallback', () => {
    it('should return true and call upsertUserOnSignIn on successful sign in', () => {
      const result = signInCallback({ user: mockUser, account: mockAccount });
      expect(result).toBe(true);
      expect(userRepo.upsertUserOnSignIn).toHaveBeenCalledTimes(1);
      expect(userRepo.upsertUserOnSignIn).toHaveBeenCalledWith(mockUser, mockAccount);
    });

    it('should return true if account is null', () => {
      const result = signInCallback({ user: mockUser, account: null });
      expect(result).toBe(true);
      expect(userRepo.upsertUserOnSignIn).not.toHaveBeenCalled();
    });

    // User type doesn't strictly enforce non-null id/email at top level, AdapterUser might not have it
    // Test with a user potentially missing email, although our repo function handles this
    it('should return true if user has no email (repository handles internal check)', () => {
      const userWithoutEmail = { ...mockUser, email: null };
      const result = signInCallback({ user: userWithoutEmail, account: mockAccount });
      expect(result).toBe(true); // Still returns true because upsertUserOnSignIn handles the check internally now
      expect(userRepo.upsertUserOnSignIn).toHaveBeenCalledTimes(1);
      expect(userRepo.upsertUserOnSignIn).toHaveBeenCalledWith(userWithoutEmail, mockAccount);
    });

    it('should return false if upsertUserOnSignIn throws an error', () => {
      vi.mocked(userRepo.upsertUserOnSignIn).mockImplementationOnce(() => {
        throw new Error('DB error');
      });
      const result = signInCallback({ user: mockUser, account: mockAccount });
      expect(result).toBe(false);
      expect(userRepo.upsertUserOnSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('jwtCallback', () => {
    const mockDbUser = { id: 999 }; // Internal DB id

    it('should add provider, email, dbId, and isAdmin (false) to token for regular user', () => {
      vi.mocked(userRepo.findUserByProvider).mockReturnValue(mockDbUser);

      const token = jwtCallback({ token: mockTokenBase, user: mockUser, account: mockAccount });

      expect(userRepo.findUserByProvider).toHaveBeenCalledTimes(1);
      expect(userRepo.findUserByProvider).toHaveBeenCalledWith(mockUser.id, mockAccount.provider);
      expect(token).toEqual({
        ...mockTokenBase,
        provider: mockAccount.provider,
        email: mockUser.email,
        dbId: mockDbUser.id,
        isAdmin: false,
      });
    });

    it('should add isAdmin (true) to token for admin user', () => {
      vi.mocked(userRepo.findUserByProvider).mockReturnValue({ id: 1000 });

      const adminTokenBase = {
        ...mockTokenBase,
        sub: mockUserAdmin.id,
        email: mockUserAdmin.email,
      };
      const token = jwtCallback({
        token: adminTokenBase as JWT,
        user: mockUserAdmin,
        account: mockAccount,
      });

      expect(userRepo.findUserByProvider).toHaveBeenCalledTimes(1);
      expect(userRepo.findUserByProvider).toHaveBeenCalledWith(
        mockUserAdmin.id,
        mockAccount.provider
      );
      expect(token).toEqual({
        ...adminTokenBase,
        provider: mockAccount.provider,
        email: mockUserAdmin.email,
        dbId: 1000,
        isAdmin: true,
      });
    });

    it('should not add dbId if findUserByProvider returns null', () => {
      vi.mocked(userRepo.findUserByProvider).mockReturnValue(null);

      const token = jwtCallback({ token: mockTokenBase, user: mockUser, account: mockAccount });

      expect(userRepo.findUserByProvider).toHaveBeenCalledTimes(1);
      expect(token).toEqual({
        ...mockTokenBase,
        provider: mockAccount.provider,
        email: mockUser.email,
        // dbId is missing
        isAdmin: false,
      });
    });

    it('should not add dbId if findUserByProvider throws an error', () => {
      vi.mocked(userRepo.findUserByProvider).mockImplementationOnce(() => {
        throw new Error('DB Lookup Failed');
      });

      const token = jwtCallback({ token: mockTokenBase, user: mockUser, account: mockAccount });

      expect(userRepo.findUserByProvider).toHaveBeenCalledTimes(1);
      // Should still return token structure, but without dbId
      expect(token).toEqual({
        ...mockTokenBase,
        provider: mockAccount.provider,
        email: mockUser.email,
        // dbId is missing
        isAdmin: false,
      });
      // We might want to check console.error was called if vitest supports that easily
    });

    it('should return original token if account or user is missing', () => {
      const token1 = jwtCallback({ token: mockTokenBase, user: mockUser, account: null });
      expect(token1).toEqual(mockTokenBase);

      // Omit the user property entirely when testing the undefined case
      const token2 = jwtCallback({ token: mockTokenBase, account: mockAccount });
      expect(token2).toEqual(mockTokenBase);

      expect(userRepo.findUserByProvider).not.toHaveBeenCalled();
    });

    it('should handle user without email gracefully', () => {
      const userWithoutEmail = { ...mockUser, id: 'provider-user-no-email', email: null };
      const localMockAccount = { ...mockAccount, providerAccountId: 'provider-user-no-email' };
      // When email is null, the jwtCallback skips the block that calls findUserByProvider
      // Create a token base specific to this user ID
      const tokenBaseWithoutEmail = {
        ...mockTokenBase,
        sub: userWithoutEmail.id,
        email: null,
      };

      const token = jwtCallback({
        token: tokenBaseWithoutEmail as JWT,
        user: userWithoutEmail,
        account: localMockAccount,
      });

      // Expect findUserByProvider NOT to be called
      expect(userRepo.findUserByProvider).not.toHaveBeenCalled();
      expect(token).toEqual({
        ...tokenBaseWithoutEmail,
        provider: localMockAccount.provider,
        email: null,
        // dbId is NOT added
        isAdmin: false, // isAdmin is always false if email is missing or not in admin list
      });
    });
  });

  describe('sessionCallback', () => {
    it('should add id, dbId, isAdmin, and provider to session user from token', () => {
      const tokenWithData: JWT = {
        ...mockTokenBase,
        dbId: 1001,
        isAdmin: true,
        provider: 'github',
      };
      const session = sessionCallback({ session: mockSessionBase, token: tokenWithData });

      expect(session.user).toEqual({
        ...mockSessionBase.user,
        id: tokenWithData.sub, // From token.sub
        dbId: tokenWithData.dbId,
        isAdmin: tokenWithData.isAdmin,
        provider: tokenWithData.provider,
      });
    });

    it('should handle missing optional token fields gracefully', () => {
      const tokenMinimal: JWT = { sub: 'provider-user-789' };
      const sessionBaseMinimal: Session = { user: { id: '' }, expires: 'date' }; // Initialize with empty id

      const session = sessionCallback({ session: sessionBaseMinimal, token: tokenMinimal });

      expect(session.user).toEqual({
        id: 'provider-user-789', // Only ID is added
        // dbId, isAdmin, provider are missing
      });
    });

    it('should handle token dbId being non-numeric (should not happen but test defensively)', () => {
      const tokenMinimalWithBadDbId: JWT = {
        sub: 'provider-user-bad-dbid',
        dbId: 'not-a-number' as any, // Use 'as any' to bypass type check
      };
      const sessionMinimal: Session = { user: { id: '' }, expires: 'date' }; // Init with empty id

      const session = sessionCallback({ session: sessionMinimal, token: tokenMinimalWithBadDbId });

      // Expect user.id to be set from token.sub, but user.dbId to remain undefined
      expect(session.user).toEqual({
        id: 'provider-user-bad-dbid',
        // dbId should remain undefined
      });
      expect(session.user.dbId).toBeUndefined();
    });

    it('should handle token isAdmin being non-boolean', () => {
      const tokenMinimalWithBadAdmin: JWT = {
        sub: 'provider-user-bad-admin',
        isAdmin: 'not-a-boolean' as any, // Use 'as any' to bypass type check
      };
      const sessionMinimal: Session = { user: { id: '' }, expires: 'date' }; // Init with empty id

      const session = sessionCallback({ session: sessionMinimal, token: tokenMinimalWithBadAdmin });

      // Expect user.id to be set, but user.isAdmin to remain undefined
      expect(session.user).toEqual({
        id: 'provider-user-bad-admin',
        // isAdmin should remain undefined
      });
      expect(session.user.isAdmin).toBeUndefined();
    });
  });
});
