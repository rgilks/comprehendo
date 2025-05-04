'use client';

import { useRouter, usePathname } from 'next/navigation';
import useTextGeneratorStore from '../store/textGeneratorStore';
import { getTextDirection, SPEECH_LANGUAGES, type Language } from '@/lib/domain/language';

export const useLanguage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const language = useTextGeneratorStore((state) => state.language);
  const setLanguage = useTextGeneratorStore((state) => state.setLanguage);
  const languages = useTextGeneratorStore((state) => state.languages);

  const handleSetLanguage = async (lang: Language) => {
    await setLanguage(lang, router, pathname);
  };

  return {
    language,
    setLanguage: handleSetLanguage,
    languages,
  };
};

export { getTextDirection, SPEECH_LANGUAGES, type Language };
