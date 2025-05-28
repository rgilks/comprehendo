import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout from './layout';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'NEXT_LOCALE') {
        return { value: 'fr' };
      }
      return undefined;
    }),
  })),
}));

vi.mock('next/font/google', () => ({
  Poppins: () => ({
    className: 'mock-poppins-class',
  }),
}));

vi.mock('@/components/AuthProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock('@/components/PWAInstall', () => ({
  default: () => <div data-testid="pwa-install">PWAInstall Mock</div>,
}));

describe('RootLayout', () => {
  it('renders children correctly', async () => {
    const TestChild = () => <div>Test Child Content</div>;
    render(
      await RootLayout({
        children: <TestChild />,
      })
    );
    expect(screen.getByText('Test Child Content')).toBeInTheDocument();
  });

  it('sets the lang attribute based on cookies', async () => {
    render(
      await RootLayout({
        children: <div>Child</div>,
      })
    );
    expect(document.documentElement).toHaveAttribute('lang', 'fr');
  });

  it('renders AuthProvider', async () => {
    render(
      await RootLayout({
        children: <div>Child</div>,
      })
    );
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });
});
