import 'vitest-dom/extend-expect';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { enableMapSet } from 'immer';

// Mock environment variables needed for tests
process.env.AUTH_SECRET = 'dummy-test-secret'; // Provide a dummy secret for authOptions loading

// Mock next/navigation
vi.mock('next/navigation', () => ({
  // const actual = vi.importActual('next/navigation'); // Avoid spreading potentially problematic actual
  // return {
  //   ...actual,
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => ''), // Provide a default pathname
  // Add other specific mocks from next/navigation if needed by tests
  // };
}));

// Mock next/font/google
vi.mock('next/font/google', () => ({
  Inter: () => ({ style: { fontFamily: 'mocked-inter' } }),
  Roboto_Mono: () => ({ style: { fontFamily: 'mocked-roboto-mono' } }),
  // Add other fonts if needed
}));

// Mock @vercel/analytics/react
vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => null, // Render nothing for Analytics component
}));

// Enable Immer plugin for Map and Set
enableMapSet();

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
