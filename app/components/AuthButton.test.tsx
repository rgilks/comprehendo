import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AuthButton from './AuthButton';

const mockState = {
  session: null as any,
  status: 'unauthenticated' as 'loading' | 'authenticated' | 'unauthenticated',
  signIn: vi.fn(),
  signOut: vi.fn(),
};

vi.mock('next/image', () => ({ __esModule: true, default: (props: any) => <img {...props} /> }));
vi.mock('next/link', () => ({ __esModule: true, default: (props: any) => <a {...props} /> }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mockState.session, status: mockState.status }),
  signIn: (...args: any[]) => mockState.signIn(...args),
  signOut: (...args: any[]) => mockState.signOut(...args),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const setSession = (s: any) => {
  mockState.session = s;
  mockState.status = s ? 'authenticated' : 'unauthenticated';
};
const setStatus = (s: any) => {
  mockState.status = s;
};

describe('AuthButton', () => {
  beforeEach(() => {
    setSession(null);
    setStatus('unauthenticated');
    mockState.signIn.mockClear();
    mockState.signOut.mockClear();
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    setStatus('loading');
    render(<AuthButton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows sign in buttons (full)', () => {
    render(<AuthButton variant="full" />);
    expect(screen.getByText('auth.signInGoogle')).toBeInTheDocument();
    expect(screen.getByText('auth.signInGitHub')).toBeInTheDocument();
    expect(screen.getByText('auth.signInDiscord')).toBeInTheDocument();
  });

  it('shows sign in buttons (icon-only)', () => {
    render(<AuthButton variant="icon-only" />);
    expect(screen.getAllByRole('button').length).toBe(3);
  });

  it('shows sign in buttons (short)', () => {
    render(<AuthButton variant="short" />);
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText((content) => /github/i.test(content))).toBeInTheDocument();
    expect(screen.getByText('Discord')).toBeInTheDocument();
  });

  it('calls signIn for each provider', () => {
    render(<AuthButton />);
    fireEvent.click(screen.getByTitle('auth.signInGoogle'));
    fireEvent.click(screen.getByTitle('auth.signInGitHub'));
    fireEvent.click(screen.getByTitle('auth.signInDiscord'));
    expect(mockState.signIn).toHaveBeenCalledWith('google');
    expect(mockState.signIn).toHaveBeenCalledWith('github');
    expect(mockState.signIn).toHaveBeenCalledWith('discord');
  });

  it('shows user info and menu for authenticated user', async () => {
    setSession({ user: { name: 'Test User', email: 'test@example.com', image: 'img.png' } });
    render(<AuthButton />);
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByTestId('sign-out-button')).toBeInTheDocument();
  });

  it('shows admin link for admin user', () => {
    setSession({ user: { name: 'Admin', email: 'admin@example.com', isAdmin: true } });
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('navigation.admin')).toBeInTheDocument();
  });

  it('calls signOut on sign out button', () => {
    setSession({ user: { name: 'Test User', email: 'test@example.com' } });
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByTestId('sign-out-button'));
    expect(mockState.signOut).toHaveBeenCalled();
  });

  it('closes user menu when clicking outside', async () => {
    setSession({ user: { name: 'Test User', email: 'test@example.com' } });
    render(<AuthButton />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('sign-out-button')).toBeVisible();
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(
        screen.getByTestId('sign-out-button').parentElement?.parentElement?.parentElement
      ).toHaveClass('pointer-events-none');
    });
  });
});
