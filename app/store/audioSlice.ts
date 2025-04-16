import type { StateCreator } from 'zustand';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import type { TextGeneratorState } from './textGeneratorStore';

// Define the structure for storing voice information
interface VoiceInfo {
  uri: string;
  displayName: string;
}

export interface AudioSlice {
  isSpeechSupported: boolean;
  isSpeakingPassage: boolean;
  isPaused: boolean;
  volume: number;
  currentWordIndex: number | null;
  passageUtteranceRef: SpeechSynthesisUtterance | null;
  wordsRef: string[];
  availableVoices: VoiceInfo[];
  selectedVoiceURI: string | null;

  setVolumeLevel: (volume: number) => void;
  stopPassageSpeech: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  getTranslation: (word: string, sourceLang: string, targetLang: string) => Promise<string | null>;
  speakText: (text: string | null, lang: Language) => void;
  _setIsSpeechSupported: (supported: boolean) => void;
  _updateAvailableVoices: (lang: Language) => void;
  setSelectedVoiceURI: (uri: string | null) => void;
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
  availableVoices: [],
  selectedVoiceURI: null,

  _setIsSpeechSupported: (supported) =>
    set((state) => {
      state.isSpeechSupported = supported;
      if (supported && typeof window !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          get()._updateAvailableVoices(get().passageLanguage);
        };
        get()._updateAvailableVoices(get().passageLanguage);
      }
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

      // Find the full voice object using the stored URI
      const selectedVoiceURI = get().selectedVoiceURI;
      const selectedVoice = selectedVoiceURI
        ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === selectedVoiceURI)
        : null;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

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
        const logPayload = {
          event,
          text: quizData?.paragraph?.substring(0, 100) + '...',
          voiceURI: utterance.voice?.voiceURI,
          lang: utterance.lang,
        };
        if (event.error === 'interrupted') {
          console.info(`Speech synthesis interrupted in handlePlayPause: ${event.error}`);
        } else {
          console.error(`Speech synthesis error in handlePlayPause: ${event.error}`, logPayload);
        }
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

    // Find the full voice object using the stored URI
    const selectedVoiceURI = get().selectedVoiceURI;
    const selectedVoice = selectedVoiceURI
      ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === selectedVoiceURI)
      : null;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      const logPayload = {
        event,
        text: text?.substring(0, 100) + '...',
        voiceURI: utterance.voice?.voiceURI,
        lang: utterance.lang,
      };
      if (event.error === 'interrupted') {
        console.info(`Speech synthesis interrupted in speakText: ${event.error}`);
      } else {
        console.error(`Speech synthesis error in speakText: ${event.error}`, logPayload);
      }
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

  _updateAvailableVoices: (lang) => {
    if (!get().isSpeechSupported || typeof window === 'undefined') return;
    const speechLang = SPEECH_LANGUAGES[lang];
    const baseLangCode = speechLang.split('-')[0];

    const platform = navigator.platform.toUpperCase();
    const isIOS =
      platform.indexOf('IPHONE') >= 0 ||
      platform.indexOf('IPAD') >= 0 ||
      platform.indexOf('IPOD') >= 0;

    let voices = window.speechSynthesis.getVoices();

    // Filter voices based on language
    if (isIOS) {
      voices = voices.filter((voice) => voice.lang === speechLang);
    } else {
      voices = voices.filter(
        (voice) => voice.lang.startsWith(baseLangCode + '-') || voice.lang === baseLangCode
      );
    }

    // Filter out macOS default voices with the pattern "Name (Language (Region))"
    voices = voices.filter(
      (voice) =>
        navigator.platform.toUpperCase().indexOf('MAC') < 0 || !/\s\(.*\s\(.*\)\)$/.test(voice.name)
    );

    const processedVoices = voices.map(
      (voice): { uri: string; displayName: string; originalLang: string } => {
        let displayName = voice.name;
        const isWindows = platform.indexOf('WIN') >= 0;

        // Simplify Windows voice names
        if (isWindows && displayName.startsWith('Microsoft ')) {
          const match = displayName.match(/^Microsoft\s+([^\s]+)\s+-/);
          if (match && match[1]) {
            displayName = match[1];
          }
        }
        // Simplify iOS voice names
        else if (isIOS) {
          displayName = displayName.replace(/\s\((Enhanced|Default|Premium|Compact)\)$/i, '');
          displayName = displayName.replace(/\s\(.*\)$/, '');
        }

        return { uri: voice.voiceURI, displayName, originalLang: voice.lang };
      }
    );

    // Deduplication logic
    const nameCounts = processedVoices.reduce<Record<string, number>>((acc, voice) => {
      acc[voice.displayName] = (acc[voice.displayName] || 0) + 1;
      return acc;
    }, {});

    const finalVoicesWithLang = processedVoices.map((voice) => {
      if (nameCounts[voice.displayName] > 1) {
        return {
          ...voice,
          displayName: `${voice.displayName} (${voice.originalLang})`,
        };
      }
      return voice;
    });

    const finalNameCounts = finalVoicesWithLang.reduce<Record<string, number>>((acc, voice) => {
      acc[voice.displayName] = (acc[voice.displayName] || 0) + 1;
      return acc;
    }, {});

    const finalNumberedVoices = finalVoicesWithLang.map((voice) => {
      if (finalNameCounts[voice.displayName] > 1) {
        const index = finalVoicesWithLang
          .filter((v) => v.displayName === voice.displayName)
          .findIndex((v) => v.uri === voice.uri);
        return {
          ...voice,
          displayName: `${voice.displayName} ${index + 1}`,
        };
      }
      return voice;
    });

    set((state) => {
      state.availableVoices = finalNumberedVoices.map(({ uri, displayName }) => ({
        uri,
        displayName,
      }));
      const currentSelectedVoiceAvailable = finalNumberedVoices.some(
        (v) => v.uri === state.selectedVoiceURI
      );

      if (!currentSelectedVoiceAvailable) {
        state.selectedVoiceURI = finalNumberedVoices.length > 0 ? finalNumberedVoices[0].uri : null;
      }
    });
  },

  setSelectedVoiceURI: (uri) => {
    set((state) => {
      state.selectedVoiceURI = uri;
    });
    if (get().isSpeakingPassage) {
      const { handlePlayPause } = get();
      get().stopPassageSpeech();
      setTimeout(() => handlePlayPause(), 100);
    }
  },
});
