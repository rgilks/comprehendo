import { createInstance, type i18n as i18nInstance } from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next/initReactI18next';
import { type Language } from './contexts/LanguageContext'; // Assuming Language type is here
// import i18nConfig from '../../i18n.config'; // If you have a central config file

// Default configuration (consider moving to a separate config file like i18n.config.ts)
const i18nConfig = {
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'],
  ns: ['common'], // Default namespaces
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // React already safes from xss
  },
  react: {
    useSuspense: false, // Recommended false for SSR
  },
};

export async function initServerI18n(
  language: Language,
  namespaces: string | string[] = i18nConfig.ns
): Promise<i18nInstance> {
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
      preload: i18nConfig.supportedLngs, // Preload all languages on server
    });
  return i18nInstance;
}

// Optional: Export the config if needed elsewhere
export { i18nConfig };
