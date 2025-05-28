import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { i18nConfig } from '@/lib/domain/i18nConfig';

const i18n = createInstance();

i18n.use(initReactI18next);

void i18n.init({
  ...i18nConfig,
  react: {
    useSuspense: false,
  },
});

export default i18n;
