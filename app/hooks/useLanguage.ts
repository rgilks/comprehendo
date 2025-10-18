'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { getTextDirection, SPEECH_LANGUAGES } from 'app/domain/language';
import type { Language } from 'app/domain/language';

export const useLanguage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const language = useTextGeneratorStore((state) => state.language);
  const setLanguage = useTextGeneratorStore((state) => state.setLanguage);
  const languages = useTextGeneratorStore((state) => state.languages);

  // Extract language from URL pathname
  const urlLanguage = pathname.split('/')[1] as Language;

  // Sync store language with URL language on mount and URL changes
  useEffect(() => {
    if (urlLanguage !== language && languages[urlLanguage]) {
      // Update store without triggering navigation
      useTextGeneratorStore.setState({ language: urlLanguage });
    }
  }, [urlLanguage, language, languages]);

  const handleSetLanguage = async (lang: Language) => {
    const currentSearch = searchParams.toString();
    await setLanguage(lang, router, pathname, currentSearch ? `?${currentSearch}` : '');
  };

  return {
    language: languages[urlLanguage] ? urlLanguage : language, // Use URL language as source of truth
    setLanguage: handleSetLanguage,
    languages,
  };
};

export { getTextDirection, SPEECH_LANGUAGES };
