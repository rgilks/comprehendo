import { type Language, LANGUAGES } from '@/config/languages';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { initServerI18n } from '../i18n';
import PageClientContent from './PageClientContent';

export const generateMetadata = (): Metadata => {
  return {
    title: 'Comprehendo',
    description: 'An AI-powered language learning tool',
  };
};

export const generateStaticParams = () => {
  return Object.keys(LANGUAGES).map((lang) => ({
    lang,
  }));
};

type PageProps = {
  params: Promise<{ lang: string }>;
};

export default async function Page({ params }: PageProps) {
  const resolvedParams = await params;
  const lang = resolvedParams.lang as Language;

  const validLanguages = Object.keys(LANGUAGES);
  if (!validLanguages.includes(lang)) {
    notFound();
  }

  const i18nInstance = await initServerI18n(lang, 'common');

  const resources = i18nInstance.store.data;

  return <PageClientContent initialLanguage={lang} initialI18nStore={resources} />;
}
