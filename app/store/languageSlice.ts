import type { StateCreator } from 'zustand';
import {
  type Language,
  UI_LANGUAGES,
  SPEECH_LANGUAGES,
  getTextDirection,
} from '@/lib/domain/language';
import i18n from '../i18n.client';
import type { TextGeneratorState } from './textGeneratorStore';

export interface LanguageSlice {
  language: Language;
  setLanguage: (lang: Language, router: unknown, pathname: string) => Promise<void>;
  languages: typeof UI_LANGUAGES;
}

function isRouter(obj: unknown): obj is { push: (path: string) => void } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'push' in obj &&
    typeof (obj as { push?: unknown }).push === 'function'
  );
}

export const createLanguageSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  LanguageSlice
> = (set) => ({
  language: 'en',
  languages: UI_LANGUAGES,
  setLanguage: async (lang, router, pathname) => {
    let prevLang: Language | undefined;
    set((state) => {
      prevLang = state.language;
      if (state.language === lang) return;
      state.language = lang;
    });
    if (prevLang === lang) return;
    try {
      await i18n.changeLanguage(lang);
    } catch (_e) {
      // fallback: reload page if language change fails
      window.location.reload();
      return;
    }
    const segments = pathname.split('/');
    segments[1] = lang;
    const currentSearch = window.location.search;
    const newPath = segments.join('/') + currentSearch;
    if (isRouter(router)) {
      router.push(newPath);
    }
  },
});

export { getTextDirection, SPEECH_LANGUAGES, type Language };
