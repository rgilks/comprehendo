// Test setup file for vitest
import { vi } from 'vitest';

// Set up environment variables for tests
process.env.AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env['GOOGLE_CLIENT_ID'] = 'test-client-id';
process.env['GOOGLE_CLIENT_SECRET'] = 'test-client-secret';

// Mock DOM APIs for tests
global.MouseEvent = class MouseEvent {
  constructor(
    public type: string,
    public eventInitDict?: MouseEventInit
  ) {}
  target: EventTarget | null = null;
} as never;

global.document = {
  createElement: vi.fn(() => ({
    closest: vi.fn(),
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
} as never;

// Mock better-sqlite3 for tests
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
    })),
    exec: vi.fn(),
    pragma: vi.fn(),
  })),
}));

// Mock next-auth for tests
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock next/headers for tests
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));
