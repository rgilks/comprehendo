import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import { type Language } from '@/lib/domain/language';
import { i18nConfig } from '@/lib/domain/i18nConfig';

export const initServerI18n = async (
  language: Language,
  namespaces: string | string[] = i18nConfig.ns
): Promise<i18n> => {
  const i18nInstance = createInstance();
  await i18nInstance
    .use(initReactI18next)
    .use(
      resourcesToBackend(
        (lang: string, ns: string) => import(`../../public/locales/${lang}/${ns}.json`)
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
