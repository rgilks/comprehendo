import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { CSRFProtection, validateCSRF, getCSRFToken } from './csrf';

// Mock NextRequest
const createMockRequest = (
  method: string,
  headers: Record<string, string> = {},
  body?: unknown
) => {
  const mockHeaders = new Map(Object.entries(headers));
  return {
    method,
    headers: {
      get: (name: string) => mockHeaders.get(name.toLowerCase()),
    },
    url: 'https://example.com/test',
    formData: vi.fn(),
    clone: vi.fn().mockReturnThis(),
    json: vi.fn().mockResolvedValue(body || {}),
  } as unknown as NextRequest;
};

describe('CSRF Protection', () => {
  describe('CSRFProtection.generateToken', () => {
    it('should generate a valid token', () => {
      const token = CSRFProtection.generateToken();
      expect(token).toMatch(/^\d+:[a-z0-9]+:[a-z0-9]+$/);
    });

    it('should generate different tokens each time', () => {
      const token1 = CSRFProtection.generateToken();
      const token2 = CSRFProtection.generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('CSRFProtection.validateToken', () => {
    it('should validate a correct token', () => {
      const token = CSRFProtection.generateToken();
      expect(CSRFProtection.validateToken(token)).toBe(true);
    });

    it('should reject invalid token format', () => {
      expect(CSRFProtection.validateToken('invalid')).toBe(false);
      expect(CSRFProtection.validateToken('a:b')).toBe(false);
      expect(CSRFProtection.validateToken('a:b:c:d')).toBe(false);
    });

    it('should reject null/undefined tokens', () => {
      expect(CSRFProtection.validateToken(null as unknown as string)).toBe(false);
      expect(CSRFProtection.validateToken(undefined as unknown as string)).toBe(false);
      expect(CSRFProtection.validateToken('')).toBe(false);
    });

    it('should reject old tokens', () => {
      const oldTimestamp = Date.now() - 7200000; // 2 hours ago
      const token = `${oldTimestamp}:abc:def`;
      expect(CSRFProtection.validateToken(token)).toBe(false);
    });

    it('should accept recent tokens', () => {
      const recentTimestamp = Date.now() - 1800000; // 30 minutes ago
      const payload = `${recentTimestamp}:abc`;
      let hash = 0;
      for (let i = 0; i < payload.length; i++) {
        const char = payload.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      const validToken = `${recentTimestamp}:abc:${Math.abs(hash).toString(36)}`;
      expect(CSRFProtection.validateToken(validToken)).toBe(true);
    });
  });

  describe('validateCSRF', () => {
    it('should allow GET requests', async () => {
      const request = createMockRequest('GET');
      const result = await validateCSRF(request);
      expect(result).toBe(true);
    });

    it('should allow auth API routes', async () => {
      const request = createMockRequest('POST', {}, {});
      // @ts-expect-error - Mocking request.url for testing
      request.url = 'https://example.com/api/auth/signin';
      const result = await validateCSRF(request);
      expect(result).toBe(true);
    });

    it('should validate CSRF token in headers', async () => {
      const token = CSRFProtection.generateToken();
      const request = createMockRequest('POST', { 'x-csrf-token': token });
      const result = await validateCSRF(request);
      expect(result).toBe(true);
    });

    it('should reject requests without CSRF token', async () => {
      const request = createMockRequest('POST');
      const result = await validateCSRF(request);
      expect(result).toBe(false);
    });

    it('should reject requests with invalid CSRF token', async () => {
      const request = createMockRequest('POST', { 'x-csrf-token': 'invalid' });
      const result = await validateCSRF(request);
      expect(result).toBe(false);
    });

    it('should validate CSRF token in form data', async () => {
      const token = CSRFProtection.generateToken();
      const formData = new Map([['csrf-token', token]]);
      const request = createMockRequest('POST', {
        'content-type': 'application/x-www-form-urlencoded',
      });
      request.formData = vi.fn().mockResolvedValue(formData);

      const result = await validateCSRF(request);
      expect(result).toBe(true);
    });

    it('should validate CSRF token in JSON body', async () => {
      const token = CSRFProtection.generateToken();
      const request = createMockRequest(
        'POST',
        { 'content-type': 'application/json' },
        { 'csrf-token': token }
      );

      const result = await validateCSRF(request);
      expect(result).toBe(true);
    });
  });

  describe('getCSRFToken', () => {
    beforeEach(() => {
      // Mock window and document for testing
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true,
      });

      Object.defineProperty(global, 'document', {
        value: {
          head: {
            innerHTML: '',
            appendChild: vi.fn(),
          },
          createElement: vi.fn().mockReturnValue({
            name: '',
            content: '',
            setAttribute: vi.fn(),
            getAttribute: vi.fn(),
          }),
          querySelector: vi.fn(),
        },
        writable: true,
      });
    });

    it('should return empty string on server side', () => {
      const originalWindow = global.window;
      // @ts-expect-error - Testing server-side behavior
      global.window = undefined;

      const result = getCSRFToken();
      expect(result).toBe('');

      global.window = originalWindow;
    });

    it('should get token from meta tag', () => {
      const token = 'test-token';
      const mockMeta = {
        name: 'csrf-token',
        content: token,
        getAttribute: vi.fn().mockReturnValue(token),
      };
      const mockQuerySelector = vi.fn().mockReturnValue(mockMeta);
      document.querySelector = mockQuerySelector;

      const result = getCSRFToken();
      expect(result).toBe(token);
      expect(mockQuerySelector).toHaveBeenCalledWith('meta[name="csrf-token"]');
    });

    it('should generate new token if meta tag not found', () => {
      const mockQuerySelector = vi.fn().mockReturnValue(null);
      document.querySelector = mockQuerySelector;

      const result = getCSRFToken();
      expect(result).toMatch(/^\d+:[a-z0-9]+:[a-z0-9]+$/);
      expect(mockQuerySelector).toHaveBeenCalledWith('meta[name="csrf-token"]');
    });
  });
});
