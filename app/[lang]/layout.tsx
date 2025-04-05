import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { LanguageProvider, type Language } from '../contexts/LanguageContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Comprehendo',
  description: 'An AI-powered language learning tool',
};

interface LayoutProps {
  children: React.ReactNode;
  params: {
    lang: string;
  };
}

export default function RootLayout({ children, params: { lang } }: LayoutProps) {
  return (
    <html lang={lang}>
      <body className={inter.className}>
        <LanguageProvider initialLanguage={lang as Language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
