import { render, screen, cleanup } from '@testing-library/react';
import { vi } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('ProgressTracker', () => {
  it('renders nothing if unauthenticated', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'unauthenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel: 'A1', userStreak: 2 })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    const { container } = render(<ProgressTracker />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing if userStreak is null', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel: 'A1', userStreak: null })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    const { container } = render(<ProgressTracker />);
    expect(container.firstChild).toBeNull();
  });

  it.each([
    ['A1', 0],
    ['A2', 1],
    ['B1', 2],
    ['B2', 3],
    ['C1', 4],
    ['C2', 4],
  ])('renders progress for %s with streak %i', async (cefrLevel, userStreak) => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel, userStreak })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    render(<ProgressTracker />);
    expect(screen.getByTestId(`cefr-level-${cefrLevel}`)).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByTestId('cefr-level-label')).toBeInTheDocument();
  });

  it('shows start streak message', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel: 'A1', userStreak: 0 })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    render(<ProgressTracker />);
    expect(screen.getByTestId('streak-message').textContent).toBe('practice.startStreak');
  });

  it('shows keep going streak message', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel: 'A1', userStreak: 2 })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    render(<ProgressTracker />);
    expect(screen.getByTestId('streak-message').textContent).toBe('practice.keepGoing');
  });

  it('shows almost level up streak message', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({ useSession: () => ({ status: 'authenticated' }) }));
    vi.doMock('@/store/textGeneratorStore', () => ({
      default: vi.fn(() => ({ cefrLevel: 'A1', userStreak: 4 })),
    }));
    vi.doMock('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
      initReactI18next: { type: '3rdParty', init: () => {} },
    }));
    const { default: ProgressTracker } = await import('./ProgressTracker');
    render(<ProgressTracker />);
    expect(screen.getByTestId('streak-message').textContent).toBe('practice.almostLevelUp');
  });
});
