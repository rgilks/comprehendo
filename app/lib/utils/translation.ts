import { SPEECH_LANGUAGES } from 'app/domain/language';

export interface TranslationParams {
  word: string;
  fromLang: string;
  toLang: string;
  translationCache: Map<string, string>;
}

export interface TranslationResult {
  shouldTranslate: boolean;
  cacheKey: string | null;
  cachedTranslation: string | null;
  sourceLangIso: string | null;
  targetLangIso: string | null;
}

export const getCacheKey = (word: string, sourceLang: string, targetLang: string): string => {
  const cleanedWord = word.toLowerCase().trim();
  return `${sourceLang}:${targetLang}:${cleanedWord}`;
};

export const analyzeTranslation = (params: TranslationParams): TranslationResult => {
  const { word, fromLang, toLang, translationCache } = params;

  const shouldTranslate = fromLang !== toLang;

  if (!shouldTranslate) {
    return {
      shouldTranslate: false,
      cacheKey: null,
      cachedTranslation: null,
      sourceLangIso: null,
      targetLangIso: null,
    };
  }

  const fromLangSpeechCode = SPEECH_LANGUAGES[fromLang as keyof typeof SPEECH_LANGUAGES];
  const toLangSpeechCode = SPEECH_LANGUAGES[toLang as keyof typeof SPEECH_LANGUAGES];

  if (!fromLangSpeechCode || !toLangSpeechCode) {
    return {
      shouldTranslate: true,
      cacheKey: null,
      cachedTranslation: null,
      sourceLangIso: null,
      targetLangIso: null,
    };
  }

  const sourceLangIso = fromLangSpeechCode.split('-')[0];
  const targetLangIso = toLangSpeechCode.split('-')[0];

  if (!sourceLangIso || !targetLangIso) {
    return {
      shouldTranslate: true,
      cacheKey: null,
      cachedTranslation: null,
      sourceLangIso: null,
      targetLangIso: null,
    };
  }

  const cacheKey = getCacheKey(word, sourceLangIso, targetLangIso);
  const cachedTranslation = translationCache.get(cacheKey) ?? null;

  return {
    shouldTranslate: true,
    cacheKey,
    cachedTranslation,
    sourceLangIso,
    targetLangIso,
  };
};

export const canTranslate = (
  progressionPhase: string,
  creditsAvailable: number,
  isLoading: boolean,
  translation: string | null
): boolean => {
  return !isLoading && !translation && (progressionPhase === 'initial' || creditsAvailable > 0);
};
