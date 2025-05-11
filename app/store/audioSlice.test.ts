import { create, StoreApi } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createAudioSlice, AudioSlice } from './audioSlice';
import type { TextGeneratorState } from './textGeneratorStore';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { translateWordWithGoogle } from '../actions/translate';
import { filterAndFormatVoices } from '@/lib/utils/speech';

// Mock the server action
vi.mock('../actions/translate', () => ({
  translateWordWithGoogle: vi.fn(),
}));

// Mock the utility function
vi.mock('@/lib/utils/speech', () => ({
  filterAndFormatVoices: vi.fn(),
}));

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

class MockSpeechSynthesisUtterance implements SpeechSynthesisUtterance {
  text = '';
  lang = '';
  volume = 1;
  pitch = 1;
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onboundary: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
  onend: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
  onerror: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisErrorEvent) => any) | null = null;
  onmark: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
  onpause: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
  onresume: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;
  onstart: ((this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any) | null = null;

  // Implement required EventTarget methods (can be minimal if not used)
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }

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
    // Reset mocks before each test
    vi.resetAllMocks();
    (translateWordWithGoogle as ReturnType<typeof vi.fn>).mockClear();
    (filterAndFormatVoices as ReturnType<typeof vi.fn>).mockClear().mockReturnValue([]);
    (store.getState().setError as ReturnType<typeof vi.fn>).mockClear();
    speechSynthesisMock.speak.mockClear();
    speechSynthesisMock.cancel.mockClear();
  });

  describe('setIsSpeechSupported', () => {
    it('should set isSpeechSupported to true and set up onvoiceschanged', () => {
      store.getState().setIsSpeechSupported(true);
      expect(store.getState().isSpeechSupported).toBe(true);
      expect(speechSynthesisMock.onvoiceschanged).toBeInstanceOf(Function);

      expect(filterAndFormatVoices).toHaveBeenCalledTimes(1);

      if (speechSynthesisMock.onvoiceschanged) {
        speechSynthesisMock.onvoiceschanged();
      }
      expect(filterAndFormatVoices).toHaveBeenCalledTimes(2);
    });

    it('should set isSpeechSupported to false', () => {
      store.getState().setIsSpeechSupported(true);
      store.getState().setIsSpeechSupported(false);
      expect(store.getState().isSpeechSupported).toBe(false);
    });

    it('should not set onvoiceschanged if typeof window is undefined', () => {
      const originalWindow = global.window;
      (global as any).window = undefined;

      store.getState().setIsSpeechSupported(true);
      expect(store.getState().isSpeechSupported).toBe(true);
      expect(speechSynthesisMock.onvoiceschanged).toBeNull();
      expect(filterAndFormatVoices).not.toHaveBeenCalled();

      (global as any).window = originalWindow;
    });
  });

  it('sets volume level', () => {
    store.getState().setVolumeLevel(0.8);
    expect(store.getState().volume).toBe(0.8);
  });

  it('setVolumeLevel restarts speech if speaking', () => {
    store.setState({ isSpeakingPassage: true, isPaused: false });
    speechSynthesisMock.speaking = true;
    const mockUtterance = new MockSpeechSynthesisUtterance('test');
    store.setState({ passageUtteranceRef: mockUtterance });

    store.getState().setVolumeLevel(0.9);

    expect(speechSynthesisMock.cancel).toHaveBeenCalledTimes(1);
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    expect(speechSynthesisMock.speak).toHaveBeenCalledWith(mockUtterance);
    expect(mockUtterance.volume).toBe(0.9);
    expect(store.getState().isSpeakingPassage).toBe(true);
    expect(store.getState().isPaused).toBe(false);
  });

  it('setVolumeLevel does not restart speech if paused', () => {
    store.setState({ isSpeakingPassage: true, isPaused: true });
    speechSynthesisMock.speaking = true;
    const mockUtterance = new MockSpeechSynthesisUtterance('test');
    store.setState({ passageUtteranceRef: mockUtterance });

    store.getState().setVolumeLevel(0.9);

    expect(speechSynthesisMock.cancel).not.toHaveBeenCalled();
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
    expect(mockUtterance.volume).toBe(0.9);
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
    getState().handlePlayPause();
    expect(speechSynthesisMock.speak).toHaveBeenCalledTimes(1);
    expect(getState().isSpeakingPassage).toBe(true);
    expect(getState().isPaused).toBe(false);

    speechSynthesisMock.speaking = true;
    store.setState({ isSpeakingPassage: true, isPaused: false });
    getState().handlePlayPause();
    expect(speechSynthesisMock.pause).toHaveBeenCalledTimes(1);
    expect(getState().isPaused).toBe(true);

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
    expect(speechSynthesisMock.speak).not.toHaveBeenCalled();
    expect(getState().selectedVoiceURI).toBe('voice2');
    expect(getState().isSpeakingPassage).toBe(false);
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
    const mockVoices = [
      { uri: 'voice1', name: 'Voice 1' },
      { uri: 'voice2', name: 'Voice 2' },
    ];
    (filterAndFormatVoices as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockVoices);

    store.setState({ selectedVoiceURI: 'notfound', isSpeechSupported: true });
    store.getState().updateAvailableVoices('en');
    expect(filterAndFormatVoices).toHaveBeenCalledWith('en');
    expect(store.getState().availableVoices).toEqual(mockVoices);
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
    expect(utteranceArg.voice).toBeNull();
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

  it('getTranslation returns cached translation if available', async () => {
    store.getState().translationCache.set('en:es:hello', 'hola_cached');
    const result = await store.getState().getTranslation('hello', 'en', 'es');
    expect(result).toBe('hola_cached');
    expect(translateWordWithGoogle).not.toHaveBeenCalled();
  });

  it('getTranslation cleans word and calls translate action', async () => {
    (translateWordWithGoogle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      translation: 'hola_api',
    });
    const result = await store.getState().getTranslation(' hEllo! ', 'en', 'es');
    expect(translateWordWithGoogle).toHaveBeenCalledWith('hello', 'es', 'en');
    expect(result).toBe('hola_api');
    expect(store.getState().translationCache.get('en:es:hello')).toBe('hola_api');
  });

  it('getTranslation handles translation failure and sets error', async () => {
    const error = new Error('API error');
    (translateWordWithGoogle as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
    const result = await store.getState().getTranslation('bonjour', 'fr', 'en');
    expect(result).toBeNull();
    expect(store.getState().setError).toHaveBeenCalledWith('Translation service failed.');
  });

  it('updateAvailableVoices does nothing if speech not supported', () => {
    store.setState({ isSpeechSupported: false });
    store.getState().updateAvailableVoices('en');
    expect(filterAndFormatVoices).not.toHaveBeenCalled();
  });

  it('updateAvailableVoices calls filterAndFormatVoices and updates state', () => {
    const mockVoices = [
      { uri: 'voice1', name: 'Voice 1' },
      { uri: 'voice2', name: 'Voice 2' },
    ];
    (filterAndFormatVoices as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockVoices);
    store.setState({ isSpeechSupported: true });
    store.getState().updateAvailableVoices('en');
    expect(filterAndFormatVoices).toHaveBeenCalledWith('en');
    expect(store.getState().availableVoices).toEqual(mockVoices);
    expect(store.getState().selectedVoiceURI).toBe('voice1');
  });

  it('updateAvailableVoices keeps existing selection if available', () => {
    const mockVoices = [
      { uri: 'voice1', name: 'Voice 1' },
      { uri: 'voice2', name: 'Voice 2' },
    ];
    (filterAndFormatVoices as ReturnType<typeof vi.fn>).mockReturnValueOnce(mockVoices);
    store.setState({ isSpeechSupported: true, selectedVoiceURI: 'voice2' });
    store.getState().updateAvailableVoices('en');
    expect(store.getState().availableVoices).toEqual(mockVoices);
    expect(store.getState().selectedVoiceURI).toBe('voice2');
  });

  it('updateAvailableVoices selects null if no voices are returned', () => {
    (filterAndFormatVoices as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
    store.setState({ isSpeechSupported: true, selectedVoiceURI: 'voice1' });
    store.getState().updateAvailableVoices('en');
    expect(store.getState().availableVoices).toEqual([]);
    expect(store.getState().selectedVoiceURI).toBeNull();
  });

  it('handlePlayPause sets up utterance and handles onboundary', () => {
    store.setState({
      quizData: {
        paragraph: 'Hello brave world',
        question: '',
        options: { A: '', B: '', C: '', D: '' },
      },
      generatedPassageLanguage: 'en',
      isSpeechSupported: true,
    });
    store.getState().handlePlayPause();

    const utterance = store.getState().passageUtteranceRef;
    expect(utterance).not.toBeNull();

    if (!utterance) return;

    expect(utterance.text).toBe('Hello brave world');
    expect(speechSynthesisMock.speak).toHaveBeenCalledWith(utterance);
    expect(store.getState().wordsRef).toEqual(['Hello', 'brave', 'world']);

    const boundaryEvent = {
      name: 'word',
      charIndex: 6,
      charLength: 5,
      elapsedTime: 0.5,
      utterance: utterance,
    } as SpeechSynthesisEvent;

    utterance.onboundary?.(boundaryEvent);
    expect(store.getState().currentWordIndex).toBe(1);

    const boundaryEvent2 = {
      name: 'word',
      charIndex: 0,
      charLength: 5,
      elapsedTime: 0.1,
      utterance: utterance,
    } as SpeechSynthesisEvent;
    utterance.onboundary?.(boundaryEvent2);
    expect(store.getState().currentWordIndex).toBe(0);
  });

  it('handlePlayPause sets up utterance and handles onend', () => {
    store.setState({
      quizData: { paragraph: 'End test', question: '', options: { A: '', B: '', C: '', D: '' } },
      generatedPassageLanguage: 'en',
      isSpeechSupported: true,
    });

    store.getState().handlePlayPause();

    const utteranceInState = store.getState().passageUtteranceRef;
    expect(utteranceInState).not.toBeNull();

    expect(store.getState().isSpeakingPassage).toBe(true);
    store.setState({ currentWordIndex: 1, wordsRef: ['End', 'test'] });

    const endEvent = {
      utterance: utteranceInState as SpeechSynthesisUtterance,
    } as SpeechSynthesisEvent;

    if (utteranceInState) {
      utteranceInState.onend?.(endEvent);
    }
    expect(store.getState().isSpeakingPassage).toBe(false);
    expect(store.getState().isPaused).toBe(false);
    expect(store.getState().currentWordIndex).toBe(null);
    expect(store.getState().passageUtteranceRef).toBe(null);
    expect(store.getState().wordsRef).toEqual([]);
  });

  describe('handlePlayPause onerror handling', () => {
    beforeEach(() => {
      store.setState({
        quizData: {
          paragraph: 'Error handling test',
          question: '',
          options: { A: '', B: '', C: '', D: '' },
        },
        generatedPassageLanguage: 'en',
        isSpeechSupported: true,
      });
      store.getState().handlePlayPause();
    });

    it('should log info for interrupted error', () => {
      const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const utterance = store.getState().passageUtteranceRef;
      expect(utterance).not.toBeNull();
      if (!utterance) return;

      const errorEvent = {
        error: 'interrupted',
      } as SpeechSynthesisErrorEvent;
      utterance.onerror?.(errorEvent);

      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('Speech synthesis interrupted in handlePlayPause: interrupted')
      );
      consoleInfoSpy.mockRestore();
    });

    it('should log error for other errors', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const utterance = store.getState().passageUtteranceRef;
      expect(utterance).not.toBeNull();
      if (!utterance) return;

      const errorEvent = {
        error: 'network',
      } as SpeechSynthesisErrorEvent;
      utterance.onerror?.(errorEvent);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Speech synthesis error in handlePlayPause: network'),
        expect.any(Object)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  it('speakText handles onerror event', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    store.getState().speakText('test text', 'en');
    const utterance = speechSynthesisMock.speak.mock.calls[0][0] as
      | SpeechSynthesisUtterance
      | undefined;
    expect(utterance).toBeDefined();
    const errorEvent = {
      error: 'synthesis-failed',
    } as SpeechSynthesisErrorEvent;
    utterance?.onerror?.(errorEvent);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Speech synthesis error in speakText: synthesis-failed'),
      expect.any(Object)
    );
    consoleErrorSpy.mockRestore();
  });

  it('speakText handles interrupted error event', () => {
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    store.getState().speakText('test text', 'en');
    const utterance = speechSynthesisMock.speak.mock.calls[0][0] as
      | SpeechSynthesisUtterance
      | undefined;
    expect(utterance).toBeDefined();
    const errorEvent = {
      error: 'interrupted',
    } as SpeechSynthesisErrorEvent;
    utterance?.onerror?.(errorEvent);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('Speech synthesis interrupted in speakText: interrupted')
    );
    consoleInfoSpy.mockRestore();
  });
});
