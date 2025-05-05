import { create, StoreApi } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createAudioSlice, AudioSlice } from './audioSlice';
import type { TextGeneratorState } from './textGeneratorStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';

type MinimalTextGeneratorState = Pick<
  TextGeneratorState,
  'quizData' | 'generatedPassageLanguage' | 'passageLanguage' | 'setError'
>;

const minimalTextGeneratorState: MinimalTextGeneratorState = {
  quizData: { paragraph: 'Hello world', question: '', options: { A: '', B: '', C: '', D: '' } },
  generatedPassageLanguage: 'en',
  passageLanguage: 'en',
  setError: vi.fn(),
};

type AudioTestStore = MinimalTextGeneratorState & AudioSlice;

type TextGeneratorSetState = StoreApi<TextGeneratorState>['setState'];
type TextGeneratorGetState = StoreApi<TextGeneratorState>['getState'];
type TextGeneratorStoreApi = StoreApi<TextGeneratorState>;

const getTestStore = (overrides: Partial<AudioSlice> = {}) =>
  create<AudioTestStore>()(
    immer((set, get, api) => ({
      ...minimalTextGeneratorState,
      ...createAudioSlice(
        set as TextGeneratorSetState,
        get as TextGeneratorGetState,
        api as TextGeneratorStoreApi
      ),
      ...overrides,
    }))
  );

type SpeechSynthesisMock = {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
  speaking: boolean;
  onvoiceschanged: null | (() => void);
};

class MockSpeechSynthesisUtterance {
  text = '';
  lang = '';
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onboundary: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

describe('audioSlice', () => {
  let store: ReturnType<typeof getTestStore>;
  let speechSynthesisMock: SpeechSynthesisMock;
  beforeEach(() => {
    speechSynthesisMock = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [
        { voiceURI: 'voice1', name: 'Voice 1', lang: 'en-US' },
        { voiceURI: 'voice2', name: 'Voice 2', lang: 'en-GB' },
      ]),
      speaking: false,
      onvoiceschanged: null,
    };
    (window as any).speechSynthesis = speechSynthesisMock;
    store = getTestStore({
      isSpeechSupported: true,
      passageUtteranceRef: null,
      availableVoices: [],
      selectedVoiceURI: null,
      translationCache: new Map(),
      wordsRef: [],
      isSpeakingPassage: false,
      isPaused: false,
      volume: 0.5,
      currentWordIndex: null,
    });
    speechSynthesisMock.speak.mockClear();
    speechSynthesisMock.cancel.mockClear();
    speechSynthesisMock.pause.mockClear();
    speechSynthesisMock.resume.mockClear();
  });

  it('sets volume level', () => {
    store.getState().setVolumeLevel(0.8);
    expect(store.getState().volume).toBe(0.8);
  });

  it('stops passage speech', () => {
    store.setState({ isSpeakingPassage: true, isPaused: true, currentWordIndex: 1 });
    store.getState().stopPassageSpeech();
    expect(store.getState().isSpeakingPassage).toBe(false);
    expect(store.getState().isPaused).toBe(false);
    expect(store.getState().currentWordIndex).toBe(null);
  });

  it('handles play/pause toggle', () => {
    store.setState({ isSpeakingPassage: false, isPaused: false });
    store.getState().handlePlayPause();
    expect(store.getState().isSpeakingPassage).toBe(true);
    store.setState({ isSpeakingPassage: true, isPaused: false });
    store.getState().handlePlayPause();
    expect(store.getState().isPaused).toBe(true);
    store.setState({ isSpeakingPassage: true, isPaused: true });
    store.getState().handlePlayPause();
    expect(store.getState().isPaused).toBe(false);
  });

  it('handles stop', () => {
    store.setState({ isSpeakingPassage: true });
    store.getState().handleStop();
    expect(store.getState().isSpeakingPassage).toBe(false);
  });

  it('sets selected voice URI and restarts if speaking', () => {
    store.setState({ isSpeakingPassage: true });
    store.getState().setSelectedVoiceURI('voice2');
    expect(store.getState().selectedVoiceURI).toBe('voice2');
    expect(store.getState().isSpeakingPassage).toBe(false);
  });

  it('updates available voices and selects default if needed', () => {
    store.setState({ selectedVoiceURI: 'notfound' });
    store.getState().updateAvailableVoices('en');
    expect(store.getState().availableVoices.length).toBe(2);
    expect(store.getState().selectedVoiceURI).toBe('voice1');
  });

  it('caches translation result', () => {
    store.getState().translationCache.set('en:es:hello', 'hola');
    const cached = store.getState().translationCache.get('en:es:hello');
    expect(cached).toBe('hola');
  });

  it('returns null for empty or same language translation', async () => {
    const result1 = await store.getState().getTranslation('', 'en', 'es');
    expect(result1).toBeNull();
    const result2 = await store.getState().getTranslation('hello', 'en', 'en');
    expect(result2).toBeNull();
  });

  it('speakText does nothing if not supported or no text', () => {
    store.setState({ isSpeechSupported: false });
    store.getState().speakText('hi', 'en');
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
    store.setState({ isSpeechSupported: true });
    store.getState().speakText(null, 'en');
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
  });
});
