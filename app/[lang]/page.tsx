import { type Language, LANGUAGES } from '../config/languages';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { initServerI18n } from '../i18n';
import PageClientContent from './PageClientContent';

export function generateMetadata(): Metadata {
  return {
    title: 'Comprehendo',
    description: 'An AI-powered language learning tool',
  };
}

export function generateStaticParams() {
  // Generate params from the single source of truth
  return Object.keys(LANGUAGES).map((lang) => ({
    lang,
  }));
}

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang as Language;

  // Validate language against the single source of truth
  const validLanguages = Object.keys(LANGUAGES);
  if (!validLanguages.includes(lang)) {
    notFound();
  }

  // Initialize i18n for the server request
  const i18nInstance = await initServerI18n(lang, 'common');

  // Pass language and initial store data (resources) instead of the full instance
  return <PageClientContent initialLanguage={lang} initialI18nStore={i18nInstance.store.data} />;
}
