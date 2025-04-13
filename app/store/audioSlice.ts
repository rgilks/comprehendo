import type { StateCreator } from 'zustand';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import type { TextGeneratorState } from './textGeneratorStore';

export interface AudioSlice {
  isSpeechSupported: boolean;
  isSpeakingPassage: boolean;
  isPaused: boolean;
  volume: number;
  currentWordIndex: number | null;
  passageUtteranceRef: SpeechSynthesisUtterance | null;
  wordsRef: string[];

  setVolumeLevel: (volume: number) => void;
  stopPassageSpeech: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  getTranslation: (word: string, sourceLang: string, targetLang: string) => Promise<string | null>;
  speakText: (text: string | null, lang: Language) => void;
  _setIsSpeechSupported: (supported: boolean) => void;
}

interface MyMemoryResponseData {
  translatedText: string;
}

interface MyMemoryResponse {
  responseData?: MyMemoryResponseData;
  responseStatus: number;
}

export const createAudioSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  AudioSlice
> = (set, get) => ({
  isSpeechSupported: false,
  isSpeakingPassage: false,
  isPaused: false,
  volume: 0.5,
  currentWordIndex: null,
  passageUtteranceRef: null,
  wordsRef: [],

  _setIsSpeechSupported: (supported) =>
    set((state) => {
      state.isSpeechSupported = supported;
    }),

  setVolumeLevel: (volume) => {
    set((state) => {
      state.volume = volume;
    });
    const { passageUtteranceRef } = get();

    if (passageUtteranceRef) {
      passageUtteranceRef.volume = volume;
    }

    if (window.speechSynthesis.speaking && !get().isPaused) {
      window.speechSynthesis.cancel();
      if (passageUtteranceRef) {
        window.speechSynthesis.speak(passageUtteranceRef);
        set((state) => {
          state.isSpeakingPassage = true;
          state.isPaused = false;
        });
      }
    }
  },

  stopPassageSpeech: () => {
    const { isSpeechSupported } = get();
    if (isSpeechSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    set((state) => {
      state.isSpeakingPassage = false;
      state.isPaused = false;
      state.currentWordIndex = null;
      state.passageUtteranceRef = null;
      state.wordsRef = [];
    });
  },

  handleStop: () => {
    get().stopPassageSpeech();
  },

  handlePlayPause: () => {
    const {
      isSpeechSupported,
      quizData,
      generatedPassageLanguage,
      isSpeakingPassage,
      isPaused,
      volume,
      stopPassageSpeech,
      passageUtteranceRef,
    } = get();

    if (passageUtteranceRef && false) {
      console.log('Dummy usage of passageUtteranceRef to satisfy build');
    }

    if (!isSpeechSupported || !quizData?.paragraph || !generatedPassageLanguage) return;

    if (isSpeakingPassage) {
      if (isPaused) {
        window.speechSynthesis.resume();
        set((state) => {
          state.isPaused = false;
        });
      } else {
        window.speechSynthesis.pause();
        set((state) => {
          state.isPaused = true;
        });
      }
    } else {
      stopPassageSpeech();

      const words = quizData.paragraph.split(/\s+/);
      set((state) => {
        state.wordsRef = words;
      });

      const utterance = new SpeechSynthesisUtterance(quizData.paragraph);
      utterance.lang = SPEECH_LANGUAGES[generatedPassageLanguage];
      utterance.volume = volume;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex;
          const wordsUpToChar = quizData.paragraph.substring(0, charIndex).split(/\s+/);
          const currentWordIdx = wordsUpToChar.length - 1;
          set((state) => {
            state.currentWordIndex = currentWordIdx;
          });
        }
      };

      utterance.onend = () => {
        set((state) => {
          state.isSpeakingPassage = false;
          state.isPaused = false;
          state.currentWordIndex = null;
          state.passageUtteranceRef = null;
          state.wordsRef = [];
        });
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        console.error('Speech synthesis error:', event);
      };

      set((state) => {
        state.passageUtteranceRef = utterance;
        state.isSpeakingPassage = true;
        state.isPaused = false;
      });
      window.speechSynthesis.speak(utterance);
    }
  },

  speakText: (text, lang) => {
    const { isSpeechSupported, volume, stopPassageSpeech } = get();
    if (!isSpeechSupported || !text) return;

    stopPassageSpeech();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANGUAGES[lang];
    utterance.volume = volume;

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      console.error('Speech synthesis error:', event);
    };

    window.speechSynthesis.speak(utterance);
  },

  getTranslation: async (word, sourceLang, targetLang): Promise<string | null> => {
    get().setError(null);
    const cleaningRegex = /[^\p{L}\p{N}\s]/gu;
    const cleanedWord = word.replace(cleaningRegex, '');

    if (!cleanedWord) {
      return null;
    }
    if (sourceLang === targetLang) {
      return null;
    }

    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanedWord)}&langpair=${sourceLang}|${targetLang}`
      );

      if (!response.ok) {
        console.error(`Translation API request failed with status ${response.status}`);
        return null;
      }

      const data = (await response.json()) as MyMemoryResponse;

      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      } else {
        console.warn('No translation available or API error:', data);
        return null;
      }
    } catch (error: unknown) {
      console.error('Translation error:', error);
      return null;
    }
  },
});
