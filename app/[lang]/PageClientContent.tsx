'use client';

import { I18nextProvider } from 'react-i18next';
import { LanguageProvider, type Language } from '@/contexts/LanguageContext';
import HomeContent from './HomeContent';
import { Suspense } from 'react';
import i18n from '../i18n.client';
import { type Resource } from 'i18next';
import { useTranslation } from 'react-i18next';

interface PageClientContentProps {
  initialLanguage: Language;
  initialI18nStore: Resource; // Receive the store data (resources)
}

export default function PageClientContent({
  initialLanguage,
  initialI18nStore,
}: PageClientContentProps) {
  const { t } = useTranslation();
  // Ensure resources for the initial language are loaded idempotently
  Object.keys(initialI18nStore).forEach((lang) => {
    // Only process the language relevant to this page load
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
        } else {
          // console.log(`[PageClientContent] Resource bundle already exists: ${lang}/${ns}`);
        }
      });
    }
  });

  // Ensure the language is set correctly, only if it differs
  // This should ideally run only once after resources are potentially added
  if (i18n.language !== initialLanguage) {
    console.log(
      `[PageClientContent] Changing language from ${i18n.language} to ${initialLanguage}`
    );
    void i18n.changeLanguage(initialLanguage); // Handle potential promise
  }

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
}
