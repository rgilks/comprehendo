import { Metadata } from 'next';
import { initServerI18n } from '@/app/i18n';
import PageClientContent from '@/app/[lang]/PageClientContent';
import type { Language } from '@/lib/domain/language';
import { LANGUAGES } from '@/lib/domain/language';
import { notFound } from 'next/navigation';

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

interface PageProps {
  params: Promise<{ lang: Language }>;
}

const Page = async ({ params }: PageProps) => {
  const resolvedParams = await params;
  const lang = resolvedParams.lang;

  if (!LANGUAGES[lang]) {
    notFound();
  }

  const i18nInstance = await initServerI18n(lang, ['common', 'exercise']);
  const resources = i18nInstance.store.data;

  return <PageClientContent initialLanguage={lang} initialI18nStore={resources} />;
};

export default Page;
