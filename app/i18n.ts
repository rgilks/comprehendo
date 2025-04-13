import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { type Language } from '@/contexts/LanguageContext';

const i18nConfig = {
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'hi', 'he'],
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
};

export const initServerI18n = async (
  language: Language,
  namespaces: string | string[] = i18nConfig.ns
): Promise<i18n> => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (lang: string, ns: string) => import(`../public/locales/${lang}/${ns}.json`)
      )
    )
    .init({
      ...i18nConfig,
      lng: language,
      ns: namespaces,
      react: {
        useSuspense: false,
      },
    });
  return i18nInstance;
};

export { i18nConfig };
