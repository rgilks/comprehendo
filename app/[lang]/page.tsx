'use client';

import { LanguageProvider, type Language } from '../contexts/LanguageContext';
import { notFound } from 'next/navigation';
import HomeContent from './HomeContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comprehendo',
  description: 'An AI-powered language learning tool',
};

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
