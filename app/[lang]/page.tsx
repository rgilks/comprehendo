import { LanguageProvider, type Language } from '../contexts/LanguageContext';
import { notFound } from 'next/navigation';
import HomeContent from './HomeContent';
import type { Metadata } from 'next';
import type { PageProps } from 'next';

export function generateMetadata(): Metadata {
  return {
    title: 'Comprehendo',
    description: 'An AI-powered language learning tool',
  };
}

export function generateStaticParams() {
  return [
    { lang: 'en' },
    { lang: 'es' },
    { lang: 'fr' },
    { lang: 'de' },
    { lang: 'it' },
    { lang: 'pt' },
    { lang: 'ru' },
    { lang: 'zh' },
    { lang: 'ja' },
    { lang: 'ko' },
  ];
}

export default function Page({ params }: PageProps<{ lang: string }>) {
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
