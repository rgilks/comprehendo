import type { StateCreator } from 'zustand';
import { type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import {
  type Language,
  UI_LANGUAGES,
  SPEECH_LANGUAGES,
  getTextDirection,
} from 'app/domain/language';
import i18n from 'app/i18n.client';
import type { TextGeneratorState } from './textGeneratorStore';

interface LanguageState {
  language: Language;
  languages: typeof UI_LANGUAGES;
  languageGuidingText: string;
}

export interface LanguageSlice extends LanguageState {
  setLanguage: (
    lang: Language,
    router: AppRouterInstance,
    pathname: string,
    search: string
  ) => Promise<void>;
  setLanguageGuidingText: (guidingText: string) => void;
}

const isRouter = (obj: unknown): obj is { push: (path: string) => void } =>
  typeof obj === 'object' &&
  obj !== null &&
  'push' in obj &&
  typeof (obj as { push?: unknown }).push === 'function';

export const initialLanguageState = (): LanguageState => ({
  language: 'en',
  languages: UI_LANGUAGES,
  languageGuidingText: '',
});

export const createLanguageSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  LanguageSlice
> = (set, _get) => ({
  ...initialLanguageState(),
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
