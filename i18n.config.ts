import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import resourcesToBackend from 'i18next-resources-to-backend';

i18next
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`./public/locales/${language}/${namespace}.json`)
    )
  )
  .init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
