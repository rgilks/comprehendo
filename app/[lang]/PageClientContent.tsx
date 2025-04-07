'use client';

import { I18nextProvider, useTranslation } from 'react-i18next';
import { LanguageProvider, type Language } from '@/contexts/LanguageContext';
import HomeContent from './HomeContent';
import { Suspense, useEffect } from 'react';
import i18n from '../i18n.client';
import { type Resource } from 'i18next';

interface PageClientContentProps {
  initialLanguage: Language;
  initialI18nStore: Resource;
}

const PageClientContent = ({ initialLanguage, initialI18nStore }: PageClientContentProps) => {
  const { t } = useTranslation();
  // Ensure resources for the initial language are loaded idempotently
  Object.keys(initialI18nStore).forEach((lang) => {
    if (lang === initialLanguage) {
      Object.keys(initialI18nStore[lang]).forEach((ns) => {
        if (!i18n.hasResourceBundle(lang, ns)) {
          console.log(`[PageClientContent] Adding resource bundle: ${lang}/${ns}`);
          i18n.addResourceBundle(
            lang,
            ns,
            initialI18nStore[lang][ns],
            true, // deep merge
            true // overwrite
          );
        }
      });
    }
  });

  // Ensure the language is set correctly, only if it differs
  // This should ideally run only once after resources are potentially added
  useEffect(() => {
    if (i18n.language !== initialLanguage) {
      console.log(
        `[PageClientContent] Changing language from ${i18n.language} to ${initialLanguage}`
      );
      void i18n.changeLanguage(initialLanguage); // Handle potential promise
    }
  }, [initialLanguage]);

  // Use the configured singleton instance in the provider
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageProvider initialLanguage={initialLanguage}>
        <Suspense fallback={<div>{t('loadingTranslations')}</div>}>
          <HomeContent />
        </Suspense>
      </LanguageProvider>
    </I18nextProvider>
  );
};

export default PageClientContent;
