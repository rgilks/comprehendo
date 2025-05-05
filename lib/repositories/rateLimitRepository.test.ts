import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import db from '@/lib/db'; // We need to mock this
import {
  getRateLimit,
  incrementRateLimit,
  resetRateLimit,
  createRateLimit,
} from './rateLimitRepository';

// Mock the db dependency
vi.mock('@/lib/db', () => {
  const mockDb = {
    prepare: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
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
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('RateLimitRepository', () => {
  const ip = '127.0.0.1';
  const nowISO = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mocks to default behavior
    mockDb.get.mockReset().mockReturnValue(undefined);
    mockDb.run.mockReset().mockReturnValue({ changes: 1, lastInsertRowid: 0 }); // Default success

    // Spy on console
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('getRateLimit', () => {
    it('should return rate limit data if found and valid', () => {
      const validData = { request_count: 10, window_start_time: nowISO };
      mockDb.get.mockReturnValue(validData);

      const result = getRateLimit(ip);

      expect(result).toEqual(validData);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?'
      );
      expect(mockDb.get).toHaveBeenCalledWith(ip);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should return null if no record is found', () => {
      mockDb.get.mockReturnValue(undefined);
      const result = getRateLimit(ip);
      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(ip);
    });

    it('should return null and log warning if data is invalid', () => {
      const invalidData = { count: 5, startTime: nowISO }; // Invalid structure
      mockDb.get.mockReturnValue(invalidData);

      const result = getRateLimit(ip);

      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(ip);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid rate limit data found'),
        expect.anything()
      );
    });

    it('should throw error if database get fails', () => {
      const dbError = new Error('DB Read Error');
      mockDb.get.mockImplementation(() => {
        throw dbError;
      });

      expect(() => getRateLimit(ip)).toThrow(dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching rate limit'),
        dbError
      );
    });
  });

  describe('incrementRateLimit', () => {
    it('should call run with the correct SQL and params', () => {
      incrementRateLimit(ip);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?'
      );
      expect(mockDb.run).toHaveBeenCalledWith(ip);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warning if no rows were updated', () => {
      mockDb.run.mockReturnValue({ changes: 0 }); // Simulate no update
      incrementRateLimit(ip);
      expect(mockDb.run).toHaveBeenCalledWith(ip);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Increment failed: No rate limit record found')
      );
    });

    it('should throw error if database run fails', () => {
      const dbError = new Error('DB Write Error');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });

      expect(() => {
        incrementRateLimit(ip);
      }).toThrow(dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error incrementing rate limit'),
        dbError
      );
    });
  });

  describe('resetRateLimit', () => {
    it('should call run with the correct SQL and params', () => {
      resetRateLimit(ip, nowISO);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
      );
      expect(mockDb.run).toHaveBeenCalledWith(nowISO, ip);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warning if no rows were updated', () => {
      mockDb.run.mockReturnValue({ changes: 0 });
      resetRateLimit(ip, nowISO);
      expect(mockDb.run).toHaveBeenCalledWith(nowISO, ip);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reset failed: No rate limit record found')
      );
    });

    it('should throw error if database run fails', () => {
      const dbError = new Error('DB Reset Error');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });

      expect(() => {
        resetRateLimit(ip, nowISO);
      }).toThrow(dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error resetting rate limit'),
        dbError
      );
    });
  });

  describe('createRateLimit', () => {
    it('should call run with the correct SQL and params', () => {
      createRateLimit(ip, nowISO);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
      );
      expect(mockDb.run).toHaveBeenCalledWith(ip, nowISO);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warning and not throw for UNIQUE constraint violation', () => {
      const uniqueError = new Error('UNIQUE constraint failed: rate_limits.ip_address');
      mockDb.run.mockImplementation(() => {
        throw uniqueError;
      });

      // Expect it NOT to throw
      expect(() => {
        createRateLimit(ip, nowISO);
      }).not.toThrow();
      expect(mockDb.run).toHaveBeenCalledWith(ip, nowISO);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Race condition: Rate limit record for IP')
      );
      // Ensure generic error wasn't logged
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Error creating rate limit'),
        uniqueError
      );
    });

    it('should throw error for other database run failures', () => {
      const dbError = new Error('DB Insert Error');
      mockDb.run.mockImplementation(() => {
        throw dbError;
      });

      expect(() => {
        createRateLimit(ip, nowISO);
      }).toThrow(dbError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error creating rate limit'),
        dbError
      );
    });
  });
});
