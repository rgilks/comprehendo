'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import Image from 'next/image';
import LanguageSelector from 'app/components/LanguageSelector';
import AuthButton from 'app/components/AuthButton';
import TextGenerator from 'app/components/TextGenerator';

const HomeContent = () => {
  const { t } = useTranslation('common');

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-3 md:p-8 bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-700/10 via-transparent to-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-green-700/10 via-transparent to-transparent pointer-events-none"></div>

      <div className="z-10 w-full max-w-5xl">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3 md:mb-8">
          <div className="flex-shrink-0">
            <LanguageSelector />
          </div>
          <div className="flex-shrink-0">
            <AuthButton variant="icon-only" />
          </div>
        </div>

        <div className="text-center py-6 md:py-16 fade-in">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-br from-blue-500 via-indigo-500 to-green-500 bg-clip-text text-transparent">
            Comprehendo
          </h1>
          <p className="text-xl mb-3 text-gray-300 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>

        <div className="fade-in animate-delay-200">
          <TextGenerator />
        </div>

        <footer className="mt-8 md:mt-16 text-center text-sm text-gray-500 fade-in animate-delay-300">
          <p>
            {t('powered_by')} |{' '}
            <Link
              href="https://github.com/rgilks/comprehendo"
              className="underline hover:text-blue-400"
            >
              {t('github')}
            </Link>
          </p>
          <p className="mt-4 text-center">
            <a href="https://ko-fi.com/N4N31DPNUS" target="_blank" rel="noopener noreferrer">
              <Image
                width={145}
                height={36}
                className="block mx-auto"
                src="https://storage.ko-fi.com/cdn/kofi2.png?v=6"
                alt="Buy Me a Coffee at ko-fi.com"
              />
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
};

export default HomeContent;
