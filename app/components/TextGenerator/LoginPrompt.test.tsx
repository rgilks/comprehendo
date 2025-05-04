import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import React from 'react';

describe('LoginPrompt', () => {
  let mockSetShowLoginPrompt: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetShowLoginPrompt = vi.fn();
    vi.resetModules();
  });

  it('renders login prompt when unauthenticated and showLoginPrompt is true', async () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'unauthenticated' }),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      __esModule: true,
      default: () => ({
        showLoginPrompt: true,
        setShowLoginPrompt: mockSetShowLoginPrompt,
      }),
    }));
    vi.doMock('@/components/AuthButton', () => ({
      __esModule: true,
      default: ({ variant }: { variant: string }) => <div data-testid={`auth-button-${variant}`} />,
    }));
    const { default: LoginPrompt } = await import('./LoginPrompt');
    render(<LoginPrompt />);
    expect(screen.getByText('practice.signInPrompt.message')).toBeInTheDocument();
    expect(screen.getByTestId('auth-button-icon-only')).toBeInTheDocument();
    expect(screen.getByTestId('auth-button-short')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'practice.signInPrompt.dismiss' })
    ).toBeInTheDocument();
  });

  it('does not render when not unauthenticated', async () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'authenticated' }),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      __esModule: true,
      default: () => ({
        showLoginPrompt: true,
        setShowLoginPrompt: mockSetShowLoginPrompt,
      }),
    }));
    vi.doMock('@/components/AuthButton', () => ({
      __esModule: true,
      default: ({ variant }: { variant: string }) => <div data-testid={`auth-button-${variant}`} />,
    }));
    const { default: LoginPrompt } = await import('./LoginPrompt');
    render(<LoginPrompt />);
    expect(screen.queryByText('practice.signInPrompt.message')).not.toBeInTheDocument();
  });

  it('does not render when showLoginPrompt is false', async () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'unauthenticated' }),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      __esModule: true,
      default: () => ({
        showLoginPrompt: false,
        setShowLoginPrompt: mockSetShowLoginPrompt,
      }),
    }));
    vi.doMock('@/components/AuthButton', () => ({
      __esModule: true,
      default: ({ variant }: { variant: string }) => <div data-testid={`auth-button-${variant}`} />,
    }));
    const { default: LoginPrompt } = await import('./LoginPrompt');
    render(<LoginPrompt />);
    expect(screen.queryByText('practice.signInPrompt.message')).not.toBeInTheDocument();
  });

  it('calls setShowLoginPrompt(false) when dismiss button is clicked', async () => {
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'unauthenticated' }),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      __esModule: true,
      default: () => ({
        showLoginPrompt: true,
        setShowLoginPrompt: mockSetShowLoginPrompt,
      }),
    }));
    vi.doMock('@/components/AuthButton', () => ({
      __esModule: true,
      default: ({ variant }: { variant: string }) => <div data-testid={`auth-button-${variant}`} />,
    }));
    const { default: LoginPrompt } = await import('./LoginPrompt');
    render(<LoginPrompt />);
    fireEvent.click(screen.getByRole('button', { name: 'practice.signInPrompt.dismiss' }));
    expect(mockSetShowLoginPrompt).toHaveBeenCalledWith(false);
  });
});
