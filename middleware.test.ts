import { describe, it, expect, vi, beforeEach } from 'vitest';
// No direct NextResponse needed
import type { NextRequest } from 'next/server';
import middleware, { config } from './middleware'; // Updated import path for colocation

// Mock dependencies using inline factory
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(), // Define mock directly inside
}));

// Helper to create a mock NextRequest
const createMockRequest = (
  pathname: string,
  headersInit: Record<string, string> = {},
  cookiesInit: Record<string, string> = {}
): NextRequest => {
  const url = new URL(`http://localhost:3000${pathname}`);
  const headers = new Headers(headersInit);
  const cookies = new Map<string, { name: string; value: string }>();
  for (const [name, value] of Object.entries(cookiesInit)) {
    cookies.set(name, { name, value });
  }

  const request = {
    nextUrl: {
      pathname,
      clone: vi.fn(() => new URL(url.toString())),
      origin: url.origin,
      search: url.search,
      searchParams: url.searchParams,
      hash: url.hash,
      href: url.href,
    },
    headers,
    cookies: {
      get: (name: string) => cookies.get(name),
      set: (name: string, value: string) => cookies.set(name, { name, value }),
      delete: (name: string) => cookies.delete(name),
      has: (name: string) => cookies.has(name),
      [Symbol.iterator]: cookies[Symbol.iterator].bind(cookies), // Bind iterator
      entries: cookies.entries.bind(cookies), // Bind methods
      keys: cookies.keys.bind(cookies),
      values: cookies.values.bind(cookies),
      forEach: cookies.forEach.bind(cookies),
    },
    method: 'GET',
    ip: '127.0.0.1',
    geo: { city: 'Test City', country: 'Test Country' },
    clone: vi.fn(() => ({ ...request })), // Simple shallow clone
  };

  // Linter fix: Cast to unknown first to satisfy TypeScript
  return request as unknown as NextRequest;
};

describe('Middleware', async () => {
  // Make describe async to use await for import
  // Import dynamically *after* mocks are set up
  const { getToken: mockGetToken } = vi.mocked(await import('next-auth/jwt'));

  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for getToken (no user / not admin)
    mockGetToken.mockResolvedValue(null);
  });

  // --- Bot Filtering Tests ---
  it('should return 200 OK for known bot user agents', async () => {
    const botAgents = [
      'SentryUptimeBot',
      'UptimeRobot/2.0 (http://uptimerobot.com/)',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'Bytespider',
    ];
    for (const agent of botAgents) {
      const req = createMockRequest('/', { 'user-agent': agent });
      const response = await middleware(req);
      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('');
      expect(mockGetToken).not.toHaveBeenCalled(); // Check the specific mocked function
    }
  });

  it('should proceed for non-bot user agents', async () => {
    const req = createMockRequest('/', { 'user-agent': 'Mozilla/5.0' });
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).not.toBe(200);
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/en/');
  });

  // --- Locale Handling Tests ---
  it('should redirect to default locale if path is missing locale and no cookie', async () => {
    const req = createMockRequest('/some/page');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/some/page');
  });

  it('should redirect to locale from cookie if path is missing locale', async () => {
    const req = createMockRequest('/another/page', {}, { NEXT_LOCALE: 'fr' });
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/fr/another/page');
  });

  it('should not redirect if path already has a locale (non-admin)', async () => {
    const req = createMockRequest('/es/hola');
    mockGetToken.mockResolvedValue({ name: 'Test', isAdmin: false });
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('should not apply locale redirect logic to admin routes', async () => {
    const req = createMockRequest('/admin/dashboard');
    mockGetToken.mockResolvedValue({ name: 'Admin', isAdmin: true });
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  // --- Admin Route Protection Tests ---
  it('should redirect non-admin users from admin routes', async () => {
    mockGetToken.mockResolvedValue({ name: 'Test User', isAdmin: false });
    const req = createMockRequest('/admin/users');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en');
  });

  it('should redirect users without tokens from admin routes', async () => {
    mockGetToken.mockResolvedValue(null);
    const req = createMockRequest('/admin/settings');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en');
  });

  it('should allow admin users access to admin routes', async () => {
    mockGetToken.mockResolvedValue({ name: 'Admin User', isAdmin: true });
    const req = createMockRequest('/admin/protected');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  // --- General Flow Tests ---
  it('should allow regular users access to non-admin routes with locale', async () => {
    mockGetToken.mockResolvedValue({ name: 'Regular User', isAdmin: false });
    const req = createMockRequest('/en/profile');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('should handle root path correctly (redirect for locale)', async () => {
    const req = createMockRequest('/');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/');
  });

  it('should handle root path with locale correctly', async () => {
    mockGetToken.mockResolvedValue({ name: 'Test', isAdmin: false });
    const req = createMockRequest('/ja/');
    const response = await middleware(req);
    expect(response).toBeDefined();
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  // --- Test config ---
  it('should have correct matcher config', () => {
    expect(config.matcher).toEqual([
      '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)',
    ]);
  });
});
