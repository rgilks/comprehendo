import { act } from 'react';
import { useTextGeneratorStore } from './textGeneratorStore';
import { vi, beforeEach } from 'vitest';
import { getSession } from 'next-auth/react';
import { type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

// Mock next-auth/react
vi.mock('next-auth/react', () => ({
  getSession: vi.fn(),
}));

// Helper to access the mocked getSession
// @ts-expect-error - Linter seems confused about vi namespace here
const mockedGetSession = getSession as vi.Mock;

global.window = Object.create(window);
Object.defineProperty(window, 'location', {
  value: { reload: vi.fn(), search: '' },
  writable: true,
});

global.window.speechSynthesis = {
  cancel: vi.fn(),
  speak: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  getVoices: vi.fn(() => []),
  onvoiceschanged: null,
  speaking: false,
} as any;

describe('textGeneratorStore', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Ensure getSession returns null by default for these tests
    mockedGetSession.mockResolvedValue(null);
  });

  it('should initialize with all slices and their state', () => {
    const state = useTextGeneratorStore.getState();
    expect(state).toHaveProperty('showLoginPrompt');
    expect(state).toHaveProperty('passageLanguage');
    expect(state).toHaveProperty('quizData');
    expect(state).toHaveProperty('isSpeechSupported');
    expect(state).toHaveProperty('isProgressLoading');
    expect(state).toHaveProperty('language');
  });

  it('should update UI slice state', () => {
    act(() => {
      useTextGeneratorStore.getState().setShowLoginPrompt(false);
    });
    expect(useTextGeneratorStore.getState().showLoginPrompt).toBe(false);
  });

  it('should update Settings slice state', () => {
    act(() => {
      useTextGeneratorStore.getState().setPassageLanguage('es');
    });
    expect(useTextGeneratorStore.getState().passageLanguage).toBe('es');
  });

  it('should update Quiz slice state', () => {
    const quizData = {
      paragraph: 'test',
      question: 'q',
      options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    };
    act(() => {
      useTextGeneratorStore.getState().setQuizData(quizData);
    });
    expect(useTextGeneratorStore.getState().quizData).toEqual(quizData);
  });

  it('should update Audio slice state', () => {
    act(() => {
      useTextGeneratorStore.getState().setIsSpeechSupported(true);
    });
    expect(useTextGeneratorStore.getState().isSpeechSupported).toBe(true);
  });

  it('should update Progress slice state', () => {
    useTextGeneratorStore.setState({ isProgressLoading: true });
    expect(useTextGeneratorStore.getState().isProgressLoading).toBe(true);
  });

  it('should update Language slice state', async () => {
    await useTextGeneratorStore
      .getState()
      .setLanguage('fr', undefined as unknown as AppRouterInstance, '/en/page', '');
    expect(useTextGeneratorStore.getState().language).toBe('fr');
  });
});
