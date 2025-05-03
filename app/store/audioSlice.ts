import type { StateCreator } from 'zustand';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import type { TextGeneratorState } from './textGeneratorStore';
import { translateWordWithGoogle } from '../actions/translate';

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
  translationCache: Map<string, string>;

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
  translationCache: new Map<string, string>(),

  _setIsSpeechSupported: (supported) => {
    set((state) => {
      state.isSpeechSupported = supported;
      if (supported && typeof window !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          get()._updateAvailableVoices(get().passageLanguage);
        };
        get()._updateAvailableVoices(get().passageLanguage);
      }
    });
  },

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
    } = get();

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
          text: quizData.paragraph.substring(0, 100) + '...',
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
        text: text.substring(0, 100) + '...',
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

    // Generate a unique key for the cache
    const cacheKey = `${sourceLang}:${targetLang}:${cleanedWord.toLowerCase()}`;
    const cachedTranslation = get().translationCache.get(cacheKey);

    // Return cached result if it exists
    if (cachedTranslation) {
      return cachedTranslation;
    }

    try {
      const translation = await translateWordWithGoogle(cleanedWord, targetLang, sourceLang);

      // Store the successful translation in the cache
      if (translation) {
        set((state) => {
          state.translationCache.set(cacheKey, translation.translation);
        });
      }

      return translation ? translation.translation : null;
    } catch (error: unknown) {
      console.error('Error calling translateWordWithGoogle action:', error);
      get().setError('Translation service failed.');
      return null;
    }
  },

  _updateAvailableVoices: (lang) => {
    if (!get().isSpeechSupported || typeof window === 'undefined') return;
    const speechLang = SPEECH_LANGUAGES[lang];
    const baseLangCode = speechLang.split('-')[0];

    const getPlatformInfo = () => {
      const ua = navigator.userAgent;
      const nav = navigator as Navigator & { userAgentData?: { platform: string } };
      if (typeof nav.userAgentData?.platform === 'string') {
        const platform = nav.userAgentData.platform.toUpperCase();
        return {
          isIOS: platform === 'IOS' || platform === 'IPADOS',
          isMac: platform === 'MACOS',
          isWindows: platform === 'WINDOWS',
          platformString: platform,
        };
      }
      // Fallback using userAgent string parsing
      const upperUA = ua.toUpperCase();
      return {
        isIOS: /IPHONE|IPAD|IPOD/.test(upperUA),
        isMac: /MACINTOSH|MAC OS X/.test(upperUA),
        isWindows: /WIN/.test(upperUA),
        platformString: upperUA, // Less reliable, just use UA for filters if needed
      };
    };

    const { isIOS, isMac, isWindows } = getPlatformInfo();

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
    voices = voices.filter((voice) => !isMac || !/\s\(.*\s\(.*\)\)$/.test(voice.name));

    const processedVoices = voices.map(
      (voice): { uri: string; displayName: string; originalLang: string } => {
        let displayName = voice.name;

        if (isWindows && displayName.startsWith('Microsoft ')) {
          const match = displayName.match(/^Microsoft\s+([^\s]+)\s+-/);
          if (match && match[1]) {
            displayName = match[1];
          }
        }
        // Simplify iOS voice names
        else if (isIOS) {
          // Try removing everything from the first space and opening parenthesis onwards
          const parenIndex = displayName.indexOf(' (');
          if (parenIndex !== -1) {
            displayName = displayName.substring(0, parenIndex);
          }
        }

        return { uri: voice.voiceURI, displayName, originalLang: voice.lang };
      }
    );

    // Deduplication logic: Keep only the first voice for each unique simplified display name
    const uniqueVoicesMap = new Map<string, { uri: string; displayName: string }>();
    for (const voice of processedVoices) {
      if (!uniqueVoicesMap.has(voice.displayName)) {
        uniqueVoicesMap.set(voice.displayName, { uri: voice.uri, displayName: voice.displayName });
      }
    }
    const finalUniqueVoices = Array.from(uniqueVoicesMap.values());

    set((state) => {
      state.availableVoices = finalUniqueVoices;
      const currentSelectedVoiceAvailable = finalUniqueVoices.some(
        (v) => v.uri === state.selectedVoiceURI
      );

      if (!currentSelectedVoiceAvailable) {
        state.selectedVoiceURI = finalUniqueVoices.length > 0 ? finalUniqueVoices[0].uri : null;
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
      setTimeout(() => {
        handlePlayPause();
      }, 100);
    }
  },
});
