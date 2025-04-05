'use client';

import { LanguageProvider, type Language } from '../contexts/LanguageContext';
import { notFound } from 'next/navigation';
import HomeContent from './HomeContent';

type Props = {
  params: { lang: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default function LanguagePage({ params }: Props) {
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
