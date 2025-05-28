import { type Language } from './language';

export const i18nConfig = {
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [
    'zh',
    'en',
    'fil',
    'fr',
    'de',
    'el',
    'he',
    'hi',
    'it',
    'ja',
    'ko',
    'pl',
    'pt',
    'ru',
    'es',
    'th',
  ] as Language[],
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
};
