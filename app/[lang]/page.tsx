'use client';

import TextGenerator from '../components/TextGenerator';
import Link from 'next/link';
import AuthButton from '../components/AuthButton';
import { useLanguage, type Language } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import { LanguageProvider } from '../contexts/LanguageContext';
import { notFound } from 'next/navigation';
import HomeContent from './HomeContent';

function LanguageSelector() {
  const { language, setLanguage, languages } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => {
        void setLanguage(e.target.value as Language);
      }}
      className="absolute top-4 left-4 bg-transparent text-white text-sm border border-gray-600 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-500 hover:border-gray-500 transition-colors cursor-pointer"
    >
      {(Object.keys(languages) as Language[]).map((lang) => (
        <option key={lang} value={lang} className="bg-gray-800 cursor-pointer">
          {languages[lang]}
        </option>
      ))}
    </select>
  );
}

export default function LanguagePage({ params }: { params: { lang: string } }) {
  // Validate language
  const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
  if (!validLanguages.includes(params.lang)) {
    notFound();
  }

  return (
    <LanguageProvider initialLanguage={params.lang as Language}>
      <HomeContent />
    </LanguageProvider>
  );
}
