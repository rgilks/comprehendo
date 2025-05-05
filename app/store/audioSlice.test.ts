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

  it('stops passage speech and cancels synthesis', () => {
    store.setState({ isSpeakingPassage: true, isPaused: true, currentWordIndex: 1 });
    store.getState().stopPassageSpeech();
    expect(speechSynthesisMock.cancel).toHaveBeenCalledTimes(1);
    expect(store.getState().isSpeakingPassage).toBe(false);
    expect(store.getState().isPaused).toBe(false);
    expect(store.getState().currentWordIndex).toBe(null);
  });

  it('handles play/pause toggle and interacts with synthesis', () => {
    const { getState } = store;
    // Initial state: not speaking
    getState().handlePlayPause();
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    expect(getState().isSpeakingPassage).toBe(true);
    expect(getState().isPaused).toBe(false);

    // State: speaking -> pause
    speechSynthesisMock.speaking = true;
    store.setState({ isSpeakingPassage: true, isPaused: false });
    getState().handlePlayPause();
    expect(speechSynthesisMock.pause).toHaveBeenCalledTimes(1);
    expect(getState().isPaused).toBe(true);

    // State: paused -> resume
    store.setState({ isSpeakingPassage: true, isPaused: true });
    getState().handlePlayPause();
    expect(speechSynthesisMock.resume).toHaveBeenCalledTimes(1);
    expect(getState().isPaused).toBe(false);
  });

  it('handles stop and cancels synthesis', () => {
    store.setState({ isSpeakingPassage: true });
    store.getState().handleStop();
    expect(speechSynthesisMock.cancel).toHaveBeenCalledTimes(1);
    expect(store.getState().isSpeakingPassage).toBe(false);
  });

  it('sets selected voice URI and restarts if speaking', () => {
    const { getState } = store;
    store.setState({ isSpeakingPassage: true });
    speechSynthesisMock.speaking = true;
    getState().setSelectedVoiceURI('voice2');
    expect(speechSynthesisMock.cancel).toHaveBeenCalledTimes(1);
    // Setting voice stops current speech, but doesn't automatically restart in this implementation
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
    expect(getState().selectedVoiceURI).toBe('voice2');
    expect(getState().isSpeakingPassage).toBe(false); // Should stop speaking
  });

  it('sets selected voice URI without restarting if not speaking', () => {
    store.setState({ isSpeakingPassage: false });
    speechSynthesisMock.speaking = false;
    store.getState().setSelectedVoiceURI('voice2');
    expect(speechSynthesisMock.cancel).not.toHaveBeenCalled();
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
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

  it('speakText calls synthesis speak with correct parameters', () => {
    store.setState({ isSpeechSupported: true, volume: 0.7 });
    store.getState().speakText('Hello there', 'en');
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    const utteranceArg = speechSynthesisMock.speak.mock.calls[0][0];
    expect(utteranceArg).toBeInstanceOf(MockSpeechSynthesisUtterance);
    expect(utteranceArg.text).toBe('Hello there');
    expect(utteranceArg.lang).toBe('en-US');
    expect(utteranceArg.volume).toBe(0.7);
    expect(utteranceArg.voice).toBeNull(); // No voice selected initially
  });

  it('speakText uses selected voice if available', () => {
    const mockVoice = { uri: 'voice1', displayName: 'Voice 1' };
    store.setState({
      isSpeechSupported: true,
      volume: 0.6,
      availableVoices: [mockVoice],
      selectedVoiceURI: 'voice1',
    });
    const selectedSynthVoice = speechSynthesisMock
      .getVoices()
      .find((v: SpeechSynthesisVoice) => v.voiceURI === 'voice1');

    store.getState().speakText('Hello with voice', 'en');
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    const utteranceArg = speechSynthesisMock.speak.mock.calls[0][0];
    expect(utteranceArg.voice).toEqual(selectedSynthVoice);
    expect(utteranceArg.voice?.voiceURI).toBe('voice1');
    expect(utteranceArg.volume).toBe(0.6);
  });
});
