'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import useTextGeneratorStore from '../store/textGeneratorStore';
import { getTextDirection, SPEECH_LANGUAGES } from '@/lib/domain/language';
import type { Language } from '@/lib/domain/language';

export const useLanguage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const language = useTextGeneratorStore((state) => state.language);
  const setLanguage = useTextGeneratorStore((state) => state.setLanguage);
  const languages = useTextGeneratorStore((state) => state.languages);

  const handleSetLanguage = async (lang: Language) => {
    const currentSearch = '' + searchParams.toString();
    await setLanguage(lang, router, pathname, currentSearch ? `?${currentSearch}` : '');
  };

  return {
    language,
    setLanguage: handleSetLanguage,
    languages,
  };
};

export { getTextDirection, SPEECH_LANGUAGES };
