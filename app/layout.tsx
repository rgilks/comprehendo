import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import AuthProvider from './AuthProvider';
import ClientPWAWrapper from './components/ClientPWAWrapper';
import { LanguageProvider, type Language } from './contexts/LanguageContext';
import { cookies } from 'next/headers';

const poppins = Poppins({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'Comprehendo - Language Reading Practice',
  description: 'Improve your language skills with AI-powered reading comprehension exercises',
  keywords: 'language learning, reading comprehension, CEFR, AI, education',
  authors: [{ name: 'Comprehendo Team' }],
  metadataBase: new URL('https://comprehendo.app'),
  openGraph: {
    title: 'Comprehendo - AI-Powered Language Learning',
    description:
      'Practice reading comprehension in multiple languages with AI-generated passages and questions.',
    locale: 'en_US',
    type: 'website',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Comprehendo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comprehendo',
    description: 'AI-powered language learning for reading comprehension.',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'en') as Language;

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={poppins.className}>
        <AuthProvider>
          <LanguageProvider initialLanguage={locale}>
            {children}
            <ClientPWAWrapper />
          </LanguageProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
