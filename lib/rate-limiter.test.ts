import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Fix import path to be relative to the current directory
import { checkRateLimit } from './rate-limiter';

// Import the mock instance directly from the manual mock file
// Note the relative path needed because mocks aren't subject to path aliases usually
import mockDb from './__mocks__/db';

// Explicitly tell Vitest to mock the target module,
// relying on it finding the __mocks__ directory automatically.
vi.mock('@/lib/db');

// Constants from the original file
const MAX_REQUESTS_PER_HOUR = 100;

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset the manual mock before each test
    mockDb.prepare.mockClear().mockReturnThis(); // Ensure chaining is reset
    mockDb.get.mockClear();
    mockDb.run.mockClear();
    // Reset any mock return values if necessary for specific tests
    mockDb.get.mockReturnValue(undefined); // Default to IP not found

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow the first request from an IP and create a record', () => {
    const ip = '192.168.1.1';
    const expectedISOTime = new Date('2024-01-01T12:00:00.000Z').toISOString();

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(true);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(ip);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    );
    expect(mockDb.run).toHaveBeenCalledWith(ip, expectedISOTime);
  });

  it('should allow subsequent requests within the limit and increment the count', () => {
    const ip = '192.168.1.2';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    mockDb.get.mockReturnValue({ request_count: 5, window_start_time: startTime });

    vi.advanceTimersByTime(1000);

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(true);
    expect(mockDb.get).toHaveBeenCalledWith(ip);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?'
    );
    expect(mockDb.run).toHaveBeenCalledWith(ip);
    expect(mockDb.prepare).not.toHaveBeenCalledWith(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    );
  });

  it('should deny requests when the limit is reached within the window', () => {
    const ip = '192.168.1.3';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    mockDb.get.mockReturnValue({
      request_count: MAX_REQUESTS_PER_HOUR,
      window_start_time: startTime,
    });

    vi.advanceTimersByTime(1000 * 60 * 30);

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(mockDb.get).toHaveBeenCalledWith(ip);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('should allow requests after the window expires and reset the count/window', () => {
    const ip = '192.168.1.4';
    const oldStartTime = new Date('2024-01-01T10:59:59.000Z').toISOString();
    mockDb.get.mockReturnValue({
      request_count: MAX_REQUESTS_PER_HOUR,
      window_start_time: oldStartTime,
    });

    const newExpectedISOTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(true);
    expect(mockDb.get).toHaveBeenCalledWith(ip);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
    );
    expect(mockDb.run).toHaveBeenCalledWith(newExpectedISOTime, ip);
    expect(mockDb.prepare).not.toHaveBeenCalledWith(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    );
  });

  it('should return false (fail closed) if the database select operation fails', () => {
    const ip = '192.168.1.5';
    const dbError = new Error('Database connection failed');
    mockDb.get.mockImplementation(() => {
      throw dbError;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?'
    );
    expect(mockDb.get).toHaveBeenCalledWith(ip);
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
  });

  it('should return false (fail closed) if the database insert operation fails', () => {
    const ip = '192.168.1.6';
    const dbError = new Error('Insert failed');

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith('INSERT')) {
        return {
          run: vi.fn().mockImplementation(() => {
            throw dbError;
          }),
        };
      }
      return { get: mockDb.get, run: mockDb.run };
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
    );
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
    mockDb.prepare.mockImplementation(vi.fn().mockReturnThis());
  });

  it('should return false (fail closed) if the database update operation fails', () => {
    const ip = '192.168.1.7';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const dbError = new Error('Update failed');
    mockDb.get.mockReturnValue({ request_count: 5, window_start_time: startTime });
    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith('UPDATE')) {
        return {
          run: vi.fn().mockImplementation(() => {
            throw dbError;
          }),
        };
      }
      return { get: mockDb.get, run: mockDb.run };
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.advanceTimersByTime(1000);
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(mockDb.prepare).toHaveBeenCalledWith(
      'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?'
    );
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
    mockDb.prepare.mockImplementation(vi.fn().mockReturnThis());
  });
});
