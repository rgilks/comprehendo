'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'English' | 'Italian' | 'Spanish' | 'French' | 'German' | 'Hindi' | 'Hebrew';

export const LANGUAGES: Record<Language, string> = {
  English: 'English',
  Italian: 'Italiano',
  Spanish: 'Español',
  French: 'Français',
  German: 'Deutsch',
  Hindi: 'हिन्दी',
  Hebrew: 'עברית',
};

export const RTL_LANGUAGES: Language[] = ['Hebrew'];

export const BCP47_LANGUAGE_MAP: Record<Language, string> = {
  English: 'en-US',
  Italian: 'it-IT',
  Spanish: 'es-ES',
  French: 'fr-FR',
  German: 'de-DE',
  Hindi: 'hi-IN',
  Hebrew: 'he-IL',
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  languages: typeof LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('English');

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages: LANGUAGES }}>
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

export function getTextDirection(language: Language) {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
}
