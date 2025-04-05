'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import i18n from '../i18n.client'; // Import the client singleton directly
// import { useTranslation } from 'react-i18next'; // Remove explicit import of client singleton
// Import definitions from the central config file
import {
  type Language,
  LANGUAGES,
  SPEECH_LANGUAGES,
  // RTL_LANGUAGES, // Removed as it's not used directly in this context
  getTextDirection,
} from '../config/languages';

// Remove local definitions
// export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'hi';
// export const LANGUAGES: Record<Language, string> = { ... };
// export const SPEECH_LANGUAGES: Record<Language, string> = { ... };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage: Language;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // const { i18n } = useTranslation(); // Remove the useTranslation hook call
  const [language, setLanguage] = useState<Language>(initialLanguage);

  const handleLanguageChange = async (lang: Language) => {
    console.log(`[LanguageProvider handleLanguageChange] Request to change to ${lang}`);
    if (lang === language) {
      console.log(`[LanguageProvider handleLanguageChange] Already language ${lang}`);
      return; // Avoid unnecessary changes
    }

    setLanguage(lang); // Update local state
    console.log(`[LanguageProvider handleLanguageChange] Set language state to ${lang}`);

    try {
      // Use the imported singleton i18n instance
      await i18n.changeLanguage(lang);
      console.log(`[LanguageProvider handleLanguageChange] i18n.changeLanguage(${lang}) completed`);

      // Update the URL with the new language
      const segments = pathname.split('/');
      segments[1] = lang;
      // Preserve search parameters if they exist
      const currentSearch = window.location.search;
      const newPath = segments.join('/') + currentSearch;
      console.log(`[LanguageProvider handleLanguageChange] Pushing new path: ${newPath}`);
      router.push(newPath);
    } catch (error) {
      console.error('[LanguageProvider handleLanguageChange] Error changing language:', error);
      // Optionally revert state or show error
    }
  };

  console.log(
    `[LanguageProvider Render] language state: ${language}, singleton i18n.language: ${i18n.language}`
  );

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage: handleLanguageChange, languages: LANGUAGES }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Keep getTextDirection export here if components directly import it from context
// Or remove if they import directly from '../config/languages'
export { getTextDirection, LANGUAGES, SPEECH_LANGUAGES, type Language };

// Remove local getTextDirection implementation if it uses local RTL_LANGUAGES
// export function getTextDirection(language: Language) {
//   return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
// }
