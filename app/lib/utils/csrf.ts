import { NextRequest } from 'next/server';

/**
 * CSRF token generation and validation utility
 */
export const CSRFProtection = {
  /**
   * Generate a CSRF token for the current session
   */
  generateToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    const payload = `${timestamp}:${random}`;

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return `${payload}:${Math.abs(hash).toString(36)}`;
  },

  /**
   * Validate a CSRF token
   */
  validateToken(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const parts = token.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const [timestamp, random, hash] = parts;

    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (now - tokenTime > 3600000) {
      return false;
    }

    const payload = `${timestamp}:${random}`;
    let expectedHash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      expectedHash = (expectedHash << 5) - expectedHash + char;
      expectedHash = expectedHash & expectedHash;
    }

    return Math.abs(expectedHash).toString(36) === hash;
  },
};

/**
 * Middleware to validate CSRF tokens for state-changing operations
 */
export const validateCSRF = async (request: NextRequest): Promise<boolean> => {
  if (request.method === 'GET') {
    return true;
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/auth/')) {
    return true;
  }

  let csrfToken: string | null = null;
  csrfToken = request.headers.get('x-csrf-token');

  if (
    !csrfToken &&
    request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
  ) {
    const formData = await request.formData();
    csrfToken = formData.get('csrf-token') as string;
  }

  if (!csrfToken && request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.clone().json();
      csrfToken = body['csrf-token'];
    } catch {
      // Ignore JSON parsing errors
    }
  }

  if (!csrfToken) {
    console.warn('[CSRF] No CSRF token found in request');
    return false;
  }

  const isValid = CSRFProtection.validateToken(csrfToken);
  if (!isValid) {
    console.warn('[CSRF] Invalid CSRF token provided');
  }

  return isValid;
};

/**
 * Server action wrapper that includes CSRF protection
 */
export const withCSRFProtection = <T extends unknown[], R>(
  action: (...args: T) => Promise<R>,
  actionName: string
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await action(...args);
    } catch (error) {
      console.error(`[CSRF Protected Action: ${actionName}] Error:`, error);
      throw error;
    }
  };
};

/**
 * Client-side CSRF token management
 */
export const getCSRFToken = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  const metaToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (metaToken) {
    return metaToken;
  }

  return CSRFProtection.generateToken();
};

/**
 * Add CSRF token to fetch requests
 */
export const addCSRFTokenToRequest = (init: RequestInit = {}): RequestInit => {
  const token = getCSRFToken();

  const headers: Record<string, string> = {};
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }
  headers['X-CSRF-Token'] = token;

  return {
    ...init,
    headers,
  };
};
