import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Fix import path to be relative to the current directory
import { checkRateLimit } from './rate-limiter';
import * as rateLimitRepository from '@/lib/repositories/rateLimitRepository';
import type { RateLimit } from '@/lib/repositories/rateLimitRepository';

// Mock the repository functions
vi.mock('@/lib/repositories/rateLimitRepository', () => ({
  getRateLimit: vi.fn(),
  incrementRateLimit: vi.fn(),
  resetRateLimit: vi.fn(),
  createRateLimit: vi.fn(),
}));

// Constants from the original file
const MAX_REQUESTS_PER_HOUR = 100;

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.mocked(rateLimitRepository.getRateLimit).mockClear().mockReturnValue(null);
    vi.mocked(rateLimitRepository.incrementRateLimit).mockClear();
    vi.mocked(rateLimitRepository.resetRateLimit).mockClear();
    vi.mocked(rateLimitRepository.createRateLimit).mockClear();
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
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.createRateLimit).toHaveBeenCalledWith(ip, expectedISOTime);
    expect(rateLimitRepository.incrementRateLimit).not.toHaveBeenCalled();
    expect(rateLimitRepository.resetRateLimit).not.toHaveBeenCalled();
  });

  it('should allow subsequent requests within the limit and increment the count', () => {
    const ip = '192.168.1.2';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const mockRateLimit: RateLimit = { request_count: 5, window_start_time: startTime };
    vi.mocked(rateLimitRepository.getRateLimit).mockReturnValue(mockRateLimit);

    vi.advanceTimersByTime(1000);

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(true);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.incrementRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.createRateLimit).not.toHaveBeenCalled();
    expect(rateLimitRepository.resetRateLimit).not.toHaveBeenCalled();
  });

  it('should deny requests when the limit is reached within the window', () => {
    const ip = '192.168.1.3';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const mockRateLimit: RateLimit = {
      request_count: MAX_REQUESTS_PER_HOUR,
      window_start_time: startTime,
    };
    vi.mocked(rateLimitRepository.getRateLimit).mockReturnValue(mockRateLimit);

    vi.advanceTimersByTime(1000 * 60 * 30);

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.incrementRateLimit).not.toHaveBeenCalled();
    expect(rateLimitRepository.createRateLimit).not.toHaveBeenCalled();
    expect(rateLimitRepository.resetRateLimit).not.toHaveBeenCalled();
  });

  it('should allow requests after the window expires and reset the count/window', () => {
    const ip = '192.168.1.4';
    const oldStartTime = new Date('2024-01-01T10:59:59.000Z').toISOString();
    const mockRateLimit: RateLimit = {
      request_count: MAX_REQUESTS_PER_HOUR, // Count doesn't matter, window expired
      window_start_time: oldStartTime,
    };
    vi.mocked(rateLimitRepository.getRateLimit).mockReturnValue(mockRateLimit);

    const newExpectedISOTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(true);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.resetRateLimit).toHaveBeenCalledWith(ip, newExpectedISOTime);
    expect(rateLimitRepository.incrementRateLimit).not.toHaveBeenCalled();
    expect(rateLimitRepository.createRateLimit).not.toHaveBeenCalled();
  });

  it('should return false (fail closed) if the database select operation fails', () => {
    const ip = '192.168.1.5';
    const dbError = new Error('Database connection failed');
    vi.mocked(rateLimitRepository.getRateLimit).mockImplementation(() => {
      throw dbError;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
  });

  it('should return false (fail closed) if the database insert operation fails', () => {
    const ip = '192.168.1.6';
    const dbError = new Error('Insert failed');
    vi.mocked(rateLimitRepository.createRateLimit).mockImplementation(() => {
      throw dbError;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.createRateLimit).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
  });

  it('should return false (fail closed) if the database update operation fails', () => {
    const ip = '192.168.1.7';
    const startTime = new Date('2024-01-01T12:00:00.000Z').toISOString();
    const dbError = new Error('Update failed');
    const mockRateLimit: RateLimit = { request_count: 5, window_start_time: startTime };
    vi.mocked(rateLimitRepository.getRateLimit).mockReturnValue(mockRateLimit);
    vi.mocked(rateLimitRepository.incrementRateLimit).mockImplementation(() => {
      throw dbError;
    });

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.advanceTimersByTime(1000);
    const isAllowed = checkRateLimit(ip);

    expect(isAllowed).toBe(false);
    expect(rateLimitRepository.getRateLimit).toHaveBeenCalledWith(ip);
    expect(rateLimitRepository.incrementRateLimit).toHaveBeenCalledWith(ip);
    expect(errorSpy).toHaveBeenCalledWith('[RateLimiter] Error checking rate limit:', dbError);

    errorSpy.mockRestore();
  });
});
