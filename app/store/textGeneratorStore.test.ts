import { act } from 'react';
import { useTextGeneratorStore } from './textGeneratorStore';
import { vi } from 'vitest';

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
    await useTextGeneratorStore.getState().setLanguage('fr', undefined, '/en/page');
    expect(useTextGeneratorStore.getState().language).toBe('fr');
  });
});
