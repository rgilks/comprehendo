import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signInCallback, jwtCallback, sessionCallback } from './auth/callbacks';

// Mock the validatedAuthEnv module
const mockEnv = {
  AUTH_SECRET: 'test-secret',
  NODE_ENV: 'test',
  GITHUB_ID: 'test-github-id',
  GITHUB_SECRET: 'test-github-secret',
  GOOGLE_CLIENT_ID: 'test-google-id',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  DISCORD_CLIENT_ID: 'test-discord-id',
  DISCORD_CLIENT_SECRET: 'test-discord-secret',
};

vi.mock('./config/authEnv', () => ({
  validatedAuthEnv: mockEnv,
}));

// Mock the callback functions
vi.mock('./auth/callbacks', () => ({
  signInCallback: vi.fn(),
  jwtCallback: vi.fn(),
  sessionCallback: vi.fn(),
}));

describe('authOptions', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset mocks and spies before each test
    vi.resetModules(); // Important to re-evaluate authOptions with new mocks
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should have the correct basic configuration', async () => {
    const { authOptions } = await import('./authOptions');
    expect(authOptions.secret).toBe('test-secret');
    expect(authOptions.debug).toBe(true);
    expect(authOptions.session?.strategy).toBe('jwt');
    expect(authOptions.pages).toEqual({});
  });

  it('should configure all providers when credentials are provided', async () => {
    // Set all credentials
    Object.assign(mockEnv, {
      GITHUB_ID: 'test-github-id',
      GITHUB_SECRET: 'test-github-secret',
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      DISCORD_CLIENT_ID: 'test-discord-id',
      DISCORD_CLIENT_SECRET: 'test-discord-secret',
      NODE_ENV: 'test',
    });
    const { authOptions } = await import('./authOptions');
    expect(authOptions.providers).toHaveLength(3);
    // We can't easily check the *instance* of the provider,
    // but we can check if they seem to be configured correctly based on mocks
    const providerConfigs = authOptions.providers.map((p: any) => p.options);
    expect(providerConfigs).toContainEqual(expect.objectContaining({ clientId: 'test-github-id' }));
    expect(providerConfigs).toContainEqual(expect.objectContaining({ clientId: 'test-google-id' }));
    expect(providerConfigs).toContainEqual(
      expect.objectContaining({ clientId: 'test-discord-id' })
    );
  });

  it('should only configure providers with available credentials and warn for missing ones', async () => {
    // Test Case 1: Only Google credentials present
    Object.assign(mockEnv, {
      GITHUB_ID: undefined,
      GITHUB_SECRET: undefined,
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      DISCORD_CLIENT_ID: undefined,
      DISCORD_CLIENT_SECRET: undefined,
      NODE_ENV: 'test',
    });
    // Use dynamic import inside the test after resetting modules
    const { authOptions: authOptions1 } = await import('./authOptions');

    expect(authOptions1.providers).toHaveLength(1);
    expect(authOptions1.providers.map((p: any) => p.options)).toContainEqual(
      expect.objectContaining({ clientId: 'test-google-id' })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] GitHub OAuth credentials missing (GITHUB_ID and GITHUB_SECRET)'
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] Discord OAuth credentials missing (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)'
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      '[NextAuth] Google OAuth credentials missing (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'
    );
    consoleWarnSpy.mockClear(); // Clear spy for next case
    vi.resetModules(); // Reset modules again

    // Test Case 2: Only GitHub credentials present
    Object.assign(mockEnv, {
      GITHUB_ID: 'test-github-id',
      GITHUB_SECRET: 'test-github-secret',
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      DISCORD_CLIENT_ID: undefined,
      DISCORD_CLIENT_SECRET: undefined,
    });
    const { authOptions: authOptions2 } = await import('./authOptions');

    expect(authOptions2.providers).toHaveLength(1);
    expect(authOptions2.providers.map((p: any) => p.options)).toContainEqual(
      expect.objectContaining({ clientId: 'test-github-id' })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] Google OAuth credentials missing (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] Discord OAuth credentials missing (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)'
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      '[NextAuth] GitHub OAuth credentials missing (GITHUB_ID and GITHUB_SECRET)'
    );
    consoleWarnSpy.mockClear();
    vi.resetModules();

    // Test Case 3: Only Discord credentials present
    Object.assign(mockEnv, {
      GITHUB_ID: undefined,
      GITHUB_SECRET: undefined,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      DISCORD_CLIENT_ID: 'test-discord-id',
      DISCORD_CLIENT_SECRET: 'test-discord-secret',
    });
    const { authOptions: authOptions3 } = await import('./authOptions');

    expect(authOptions3.providers).toHaveLength(1);
    expect(authOptions3.providers.map((p: any) => p.options)).toContainEqual(
      expect.objectContaining({ clientId: 'test-discord-id' })
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] GitHub OAuth credentials missing (GITHUB_ID and GITHUB_SECRET)'
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[NextAuth] Google OAuth credentials missing (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'
    );
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      '[NextAuth] Discord OAuth credentials missing (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)'
    );
  });

  it('should assign the correct callback functions', async () => {
    const { authOptions } = await import('./authOptions');
    expect(authOptions.callbacks?.signIn).toBe(signInCallback);
    expect(authOptions.callbacks?.jwt).toBe(jwtCallback);
    expect(authOptions.callbacks?.session).toBe(sessionCallback);
  });

  it('should configure cookies correctly for non-production environment', async () => {
    Object.assign(mockEnv, { NODE_ENV: 'development' });
    const { authOptions } = await import('./authOptions');
    // Use if checks for type narrowing
    if (authOptions.cookies && authOptions.cookies.sessionToken) {
      const sessionCookie = authOptions.cookies.sessionToken;
      expect(sessionCookie.name).toBe('next-auth.session-token');
      expect(sessionCookie.options.secure).toBe(false);
      expect(sessionCookie.options.httpOnly).toBe(true);
      expect(sessionCookie.options.sameSite).toBe('lax');
      expect(sessionCookie.options.path).toBe('/');
    } else {
      // Fail the test if cookies or sessionToken are unexpectedly undefined
      expect(authOptions.cookies).toBeDefined();
      expect(authOptions.cookies?.sessionToken).toBeDefined();
    }
  });

  it('should configure cookies correctly for production environment', async () => {
    Object.assign(mockEnv, { NODE_ENV: 'production' });
    const { authOptions } = await import('./authOptions'); // Re-import needed due to NODE_ENV change
    // Use if checks for type narrowing
    if (authOptions.cookies && authOptions.cookies.sessionToken) {
      const sessionCookie = authOptions.cookies.sessionToken;
      expect(sessionCookie.name).toBe('__Secure-next-auth.session-token');
      expect(sessionCookie.options.secure).toBe(true);
      expect(sessionCookie.options.httpOnly).toBe(true);
      expect(sessionCookie.options.sameSite).toBe('lax');
      expect(sessionCookie.options.path).toBe('/');
    } else {
      // Fail the test if cookies or sessionToken are unexpectedly undefined
      expect(authOptions.cookies).toBeDefined();
      expect(authOptions.cookies?.sessionToken).toBeDefined();
    }
  });
});
