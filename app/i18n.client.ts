import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

const i18n = createInstance();

i18n.use(initReactI18next);

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [
    'zh', // Chinese
    'en', // English
    'fil', // Filipino
    'fr', // French
    'de', // German
    'el', // Greek
    'he', // Hebrew
    'hi', // Hindi
    'it', // Italian
    'ja', // Japanese
    'ko', // Korean
    'pl', // Polish
    'pt', // Portuguese
    'ru', // Russian
    'es', // Spanish
    'th', // Thai
  ],
  ns: ['common'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
