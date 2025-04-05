import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
// Do not import resourcesToBackend here, it's only needed server-side for initial load

const i18n = createInstance();

// Initialize plugins
i18n.use(initReactI18next);

// Initialize with minimal config, especially useSuspense: false.
// Resources will be added in PageClientContent based on server data.
void i18n.init({
  // Set initial language, although PageClientContent will override
  lng: 'en',
  fallbackLng: 'en', // Default fallback
  supportedLngs: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'hi'],
  ns: ['common'], // Specify default namespaces
  defaultNS: 'common',
  interpolation: {
    escapeValue: false, // React already escapes
  },
  react: {
    useSuspense: false, // IMPORTANT for SSR/hydration
  },
  // No backend/resource loading here
});

export default i18n;
