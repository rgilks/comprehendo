import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Dynamically import to allow env mocking before module execution
// and to test module-level errors/logs.
const importAuthEnv = async () => {
  const module = await import('./authEnv');
  return module; // Return the actual module exports
};

describe('authEnv module execution', () => {
  const originalEnv = { ...process.env };
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset modules to ensure validation runs fresh each time
    vi.resetModules();
    // Reset env and spies
    process.env = { ...originalEnv };
    delete process.env['NEXT_PHASE']; // Ensure build phase flag is cleared
    delete process.env['AUTH_SECRET']; // Ensure AUTH_SECRET is clear before tests potentially set it
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original env and spies
    process.env = originalEnv;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('should validate successfully and export env with minimal required variables', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');

    const { validatedAuthEnv } = await importAuthEnv();

    expect(validatedAuthEnv.AUTH_SECRET).toBe('test-secret');
    expect(validatedAuthEnv.ADMIN_EMAILS).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should validate successfully and export env with all provider variables', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('GITHUB_ID', 'gh-id');
    vi.stubEnv('GITHUB_SECRET', 'gh-secret');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret');
    vi.stubEnv('DISCORD_CLIENT_ID', 'discord-id');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'discord-secret');
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000');
    vi.stubEnv('ADMIN_EMAILS', 'admin1@example.com, admin2@example.com ');

    const { validatedAuthEnv } = await importAuthEnv();

    expect(validatedAuthEnv.GITHUB_ID).toBe('gh-id');
    expect(validatedAuthEnv.GITHUB_SECRET).toBe('gh-secret');
    expect(validatedAuthEnv.ADMIN_EMAILS).toEqual(['admin1@example.com', 'admin2@example.com']);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should throw an error if AUTH_SECRET is missing', async () => {
    // No AUTH_SECRET stubbed
    let errorThrown = false;
    try {
      await importAuthEnv();
    } catch (e: any) {
      expect(e.message).toMatch(/Invalid Auth environment variables/);
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
    // Error is logged before the throw
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('AUTH_SECRET');
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('AUTH_SECRET is missing');
  });

  it('should throw an error if a provider ID is set without its secret', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('GITHUB_ID', 'gh-id'); // Missing GITHUB_Secret

    let errorThrown = false;
    try {
      await importAuthEnv();
    } catch (e: any) {
      expect(e.message).toMatch(/Invalid Auth environment variables/);
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('GITHUB_SECRET');
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('required when GITHUB_ID is set');
  });

  it('should throw an error if a provider secret is set without its ID', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret'); // Missing GOOGLE_CLIENT_ID

    let errorThrown = false;
    try {
      await importAuthEnv();
    } catch (e: any) {
      expect(e.message).toMatch(/Invalid Auth environment variables/);
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('GOOGLE_CLIENT_ID');
    expect(consoleErrorSpy.mock.calls[0][1]).toContain('required when GOOGLE_CLIENT_SECRET is set');
  });

  it('should handle ADMIN_EMAILS transformation correctly', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('ADMIN_EMAILS', '  test1@test.com , test2@test.com,test3@test.com  , ');

    const { validatedAuthEnv } = await importAuthEnv();

    expect(validatedAuthEnv.ADMIN_EMAILS).toEqual([
      'test1@test.com',
      'test2@test.com',
      'test3@test.com',
    ]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should handle empty ADMIN_EMAILS string', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('ADMIN_EMAILS', '');

    const { validatedAuthEnv } = await importAuthEnv();

    expect(validatedAuthEnv.ADMIN_EMAILS).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should warn if NEXTAUTH_URL is not set in production', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production'); // Production env
    // NEXTAUTH_URL is missing

    await importAuthEnv(); // Should not throw

    // Warning is logged after successful validation
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('NEXTAUTH_URL is not set'));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should NOT warn if NEXTAUTH_URL is set in production', async () => {
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXTAUTH_URL', 'https://prod.example.com');

    await importAuthEnv();

    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('should NOT throw errors during build phase, only log them', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('AUTH_SECRET', undefined); // Explicitly missing
    vi.stubEnv('GITHUB_ID', 'gh-id'); // Missing GITHUB_Secret

    // Should not throw during build phase
    await expect(importAuthEnv()).resolves.toBeDefined();

    // Should log errors
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedErrorJson = consoleErrorSpy.mock.calls[0][1] as string;
    expect(loggedErrorJson).toContain('AUTH_SECRET'); // Zod required error
    // GITHUB_Secret error won't appear here because parse fails on AUTH_Secret first
    // expect(loggedErrorJson).toContain('GITHUB_SECRET'); // SuperRefine not reached
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Check that exported env is empty object as per module logic
    const { validatedAuthEnv } = await import('./authEnv'); // Re-import to check final state
    expect(validatedAuthEnv).toEqual({});
  });

  it('should NOT throw errors during build phase even with valid AUTH_SECRET but other errors', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('AUTH_SECRET', 'test-secret'); // Valid secret
    vi.stubEnv('GITHUB_ID', 'gh-id'); // Missing GITHUB_Secret

    // Should not throw during build phase
    await expect(importAuthEnv()).resolves.toBeDefined();

    // Should log errors
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedErrorJson = consoleErrorSpy.mock.calls[0][1] as string;
    expect(loggedErrorJson).not.toContain('AUTH_SECRET');
    expect(loggedErrorJson).toContain('GITHUB_SECRET'); // SuperRefine error
    expect(consoleWarnSpy).not.toHaveBeenCalled();

    // Check that exported env is empty object
    const { validatedAuthEnv } = await import('./authEnv');
    expect(validatedAuthEnv).toEqual({});
  });

  it('should validate successfully during build phase if all vars are correct', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.stubEnv('AUTH_SECRET', 'test-secret');
    vi.stubEnv('GITHUB_ID', 'gh-id');
    vi.stubEnv('GITHUB_SECRET', 'gh-secret');

    // Should not throw
    const { validatedAuthEnv } = await importAuthEnv();

    expect(validatedAuthEnv.AUTH_SECRET).toBe('test-secret');
    expect(validatedAuthEnv.GITHUB_ID).toBe('gh-id');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
