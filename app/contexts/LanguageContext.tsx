'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import i18n from '../i18n.client';

import {
  type Language,
  LANGUAGES,
  SPEECH_LANGUAGES,
  getTextDirection,
} from '@/lib/domain/language';

// Define the languages specifically available for the UI based on locale files
const SUPPORTED_UI_LANG_CODES: Language[] = [
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
];

const UI_LANGUAGES = Object.fromEntries(
  Object.entries(LANGUAGES).filter(([langCode]) =>
    SUPPORTED_UI_LANG_CODES.includes(langCode as Language)
  )
) as Record<(typeof SUPPORTED_UI_LANG_CODES)[number], string>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  languages: typeof UI_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: Language;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const handleLanguageChange = async (lang: Language) => {
    console.log(`[LanguageProvider handleLanguageChange] Request to change to ${lang}`);
    if (lang === language) {
      console.log(`[LanguageProvider handleLanguageChange] Already language ${lang}`);
      return;
    }

    setLanguage(lang);
    console.log(`[LanguageProvider handleLanguageChange] Set language state to ${lang}`);

    try {
      await i18n.changeLanguage(lang);
      console.log(`[LanguageProvider handleLanguageChange] i18n.changeLanguage(${lang}) completed`);

      const segments = pathname.split('/');
      segments[1] = lang;

      const currentSearch = window.location.search;
      const newPath = segments.join('/') + currentSearch;
      console.log(`[LanguageProvider handleLanguageChange] Pushing new path: ${newPath}`);
      router.push(newPath);
    } catch (error) {
      console.error('[LanguageProvider handleLanguageChange] Error changing language:', error);
    }
  };

  console.log(
    `[LanguageProvider Render] language state: ${language}, singleton i18n.language: ${i18n.language}`
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: handleLanguageChange,
        languages: UI_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Export the filtered list for potential external use if needed
export { getTextDirection, UI_LANGUAGES, SPEECH_LANGUAGES, type Language };
