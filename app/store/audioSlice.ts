import type { StateCreator } from 'zustand';
import { z } from 'zod'; // Import Zod
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import type { TextGeneratorState } from './textGeneratorStore'; // Import combined state type

// --- Zod Schema --- START
const TranslationResponseDataSchema = z.object({
  translatedText: z.string(),
});

const TranslationResponseSchema = z.object({
  responseStatus: z.number(),
  responseData: TranslationResponseDataSchema.optional().nullable(),
});
// --- Zod Schema --- END

export interface AudioSlice {
  isSpeechSupported: boolean;
  isSpeakingPassage: boolean;
  isPaused: boolean;
  volume: number;
  currentWordIndex: number | null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  passageUtteranceRef: SpeechSynthesisUtterance | null;
  wordsRef: string[]; // Store words derived from the passage

  setVolumeLevel: (volume: number) => void;
  stopPassageSpeech: () => void;
  handlePlayPause: () => void;
  handleStop: () => void;
  getTranslation: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
  speakText: (text: string | null, lang: Language) => void;
  _setIsSpeechSupported: (supported: boolean) => void;
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

  _setIsSpeechSupported: (supported) => set({ isSpeechSupported: supported }),

  setVolumeLevel: (volume) => {
    set({ volume });
    const { passageUtteranceRef } = get();

    if (passageUtteranceRef) {
      passageUtteranceRef.volume = volume;
    }

    if (window.speechSynthesis.speaking && !get().isPaused) {
      window.speechSynthesis.cancel();
      if (passageUtteranceRef) {
        window.speechSynthesis.speak(passageUtteranceRef);
        set({ isSpeakingPassage: true, isPaused: false });
      }
    }
  },

  stopPassageSpeech: () => {
    const { isSpeechSupported } = get();
    if (isSpeechSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    set({
      isSpeakingPassage: false,
      isPaused: false,
      currentWordIndex: null,
      passageUtteranceRef: null,
      wordsRef: [],
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

    // Explicitly "use" passageUtteranceRef to satisfy TypeScript compiler
    if (passageUtteranceRef && false) {
      console.log('This should never run, just using the ref');
    }

    if (!isSpeechSupported || !quizData?.paragraph || !generatedPassageLanguage) return;

    if (isSpeakingPassage) {
      if (isPaused) {
        window.speechSynthesis.resume();
        set({ isPaused: false });
      } else {
        window.speechSynthesis.pause();
        set({ isPaused: true });
      }
    } else {
      stopPassageSpeech();

      const words = quizData.paragraph.split(/\s+/);
      set({ wordsRef: words });

      const utterance = new SpeechSynthesisUtterance(quizData.paragraph);
      utterance.lang = SPEECH_LANGUAGES[generatedPassageLanguage];
      utterance.volume = volume;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const charIndex = event.charIndex;
          const wordsUpToChar = quizData.paragraph.substring(0, charIndex).split(/\s+/);
          const currentWordIdx = wordsUpToChar.length - 1;
          set({ currentWordIndex: currentWordIdx });
        }
      };

      utterance.onend = () => {
        set({
          isSpeakingPassage: false,
          isPaused: false,
          currentWordIndex: null,
          passageUtteranceRef: null,
          wordsRef: [],
        });
      };

      utterance.onerror = (event: any) => {
        console.error('Speech synthesis error:', event);
        get().setError('Speech synthesis failed.');
        set({
          isSpeakingPassage: false,
          isPaused: false,
          currentWordIndex: null,
          passageUtteranceRef: null,
          wordsRef: [],
        });
      };

      set({ passageUtteranceRef: utterance, isSpeakingPassage: true, isPaused: false });
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

    utterance.onerror = (event: any) => {
      console.error('Speech synthesis error:', event);
      get().setError('Speech synthesis failed.');
    };

    window.speechSynthesis.speak(utterance);
  },

  getTranslation: async (word, sourceLang, targetLang): Promise<string> => {
    get().setLoading(true);
    get().setError(null);
    try {
      const cleanedWord = word.replace(/[^\p{L}\p{N}\s]/gu, '');
      if (!cleanedWord) return '';

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedWord, sourceLang, targetLang }),
      });

      if (!response.ok) {
        throw new Error(`Translation API request failed with status ${response.status}`);
      }

      const rawResult = (await response.json()) as unknown;

      const validatedResult = TranslationResponseSchema.safeParse(rawResult);

      if (!validatedResult.success) {
        console.error('Zod validation error (getTranslation):', validatedResult.error.message);
        throw new Error(`Invalid API response structure: ${validatedResult.error.message}`);
      }

      const result = validatedResult.data;

      if (result.responseStatus !== 200 || !result.responseData?.translatedText) {
        console.warn('Translation API returned non-200 status or no text:', result);
        throw new Error(`Translation API failed with status ${result.responseStatus}`);
      }

      return result.responseData.translatedText;
    } catch (error: unknown) {
      console.error('Translation error:', error);
      const message: string = error instanceof Error ? error.message : 'Unknown translation error';
      get().setError(`Failed to get translation: ${message}`);
      return '';
    } finally {
      get().setLoading(false);
    }
  },
});
