'use client';

import { I18nextProvider, useTranslation } from 'react-i18next';
import { LanguageProvider, type Language } from '@/contexts/LanguageContext';
import HomeContent from './HomeContent';
import { Suspense, useEffect } from 'react';
import i18n from '../i18n.client';
import { type Resource, type i18n as I18nInstanceType } from 'i18next';

interface PageClientContentProps {
  initialLanguage: Language;
  initialI18nStore: Resource;
}

const loadInitialResources = (
  instance: I18nInstanceType,
  language: Language,
  resources: Resource
) => {
  const languageResources = resources[language];
  if (languageResources) {
    Object.keys(languageResources).forEach((ns) => {
      if (!instance.hasResourceBundle(language, ns)) {
        const namespaceResources = languageResources[ns];
        if (namespaceResources) {
          instance.addResourceBundle(language, ns, namespaceResources, true, true);
        }
      }
    });
  }
};

const PageClientContent = ({ initialLanguage, initialI18nStore }: PageClientContentProps) => {
  const { t } = useTranslation();

  loadInitialResources(i18n, initialLanguage, initialI18nStore);

  useEffect(() => {
    if (i18n.language !== initialLanguage) {
      void i18n.changeLanguage(initialLanguage);
    }
  }, [initialLanguage]);

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
