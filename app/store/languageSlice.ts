import type { StateCreator } from 'zustand';
import { type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
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
  setLanguage: (
    lang: Language,
    router: AppRouterInstance,
    pathname: string,
    search: string
  ) => Promise<void>;
  languages: typeof UI_LANGUAGES;
  languageGuidingText: string;
  setLanguageGuidingText: (guidingText: string) => void;
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
  languageGuidingText: '',
  setLanguage: async (lang, router, pathname, search) => {
    let prevLang: Language | undefined;
    set((state) => {
      prevLang = state.language;
      if (state.language === lang) return;
      state.language = lang;
    });
    if (prevLang === lang) return;
    try {
      await i18n.changeLanguage(lang);
    } catch {
      // fallback: reload page if language change fails
      window.location.reload();
      return;
    }
    const segments = pathname.split('/');
    segments[1] = lang;
    const newPath = segments.join('/') + search;
    if (isRouter(router)) {
      router.push(newPath);
    }
  },
  setLanguageGuidingText: (guidingText) => {
    set((state) => {
      state.languageGuidingText = guidingText;
    });
  },
});

export { getTextDirection, SPEECH_LANGUAGES, type Language };
