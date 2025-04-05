import { LanguageProvider, type Language } from '../contexts/LanguageContext';
import { notFound } from 'next/navigation';
import HomeContent from './HomeContent';
import type { Metadata } from 'next';
import { initServerI18n } from '../i18n';
import { Suspense } from 'react';

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

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang as Language;

  // Validate language
  const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
  if (!validLanguages.includes(lang)) {
    notFound();
  }

  // Initialize i18n on the server (still needed for correct SSR HTML)
  await initServerI18n(lang, 'common');

  return (
    <LanguageProvider initialLanguage={lang}>
      <Suspense fallback={<div>Loading translations...</div>}>
        <HomeContent />
      </Suspense>
    </LanguageProvider>
  );
}
