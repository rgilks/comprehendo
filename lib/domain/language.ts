import { z } from 'zod';

// Base Language Schema
export const LanguageSchema = z.enum([
  'zh', // Chinese
  'en', // English
  'fil', // Filipino
  'fr', // French
  'de', // German
  'el', // Greek
  'he', // Hebrew
  'hi', // Hindi
  'it', // Italian
  'ja', // Japanese
  'ko', // Korean
  'la', // Latin
  'pl', // Polish
  'pt', // Portuguese
  'ru', // Russian
  'es', // Spanish
  'th', // Thai
]);
export type Language = z.infer<typeof LanguageSchema>;

export const LANGUAGES: Record<Language, string> = {
  zh: '中文',
  en: 'English',
  fil: 'Filipino',
  fr: 'Français',
  de: 'Deutsch',
  el: 'Ελληνικά',
  he: 'עברית',
  hi: 'हिंदी',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  la: 'Latin',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  es: 'Español',
  th: 'ไทย',
};

export const SPEECH_LANGUAGES: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  fil: 'fil-PH',
  fr: 'fr-FR',
  de: 'de-DE',
  el: 'el-GR',
  he: 'he-IL',
  hi: 'hi-IN',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  la: 'la-VA', // Note: Latin speech might not be standardly supported
  pl: 'pl-PL',
  pt: 'pt-PT',
  ru: 'ru-RU',
  es: 'es-ES',
  th: 'th-TH',
};

// Define languages available for learning content
const excludedLearningLanguages = ['zh', 'ja', 'ko'];
export const LearningLanguageSchema = LanguageSchema.refine(
  (lang) => !excludedLearningLanguages.includes(lang),
  { message: 'Language not available for learning content' }
);
export type LearningLanguage = z.infer<typeof LearningLanguageSchema>;

// Create a helper to filter LANGUAGES for LEARNING_LANGUAGES
const learningLanguageValues = LanguageSchema.options.filter(
  (lang) => !excludedLearningLanguages.includes(lang)
);

export const LEARNING_LANGUAGES = learningLanguageValues.reduce(
  (acc, lang) => {
    acc[lang] = LANGUAGES[lang];
    return acc;
  },
  {} as Record<LearningLanguage, string>
);

export const RTL_LANGUAGES: Language[] = ['he'];

export const getTextDirection = (language: Language): 'ltr' | 'rtl' => {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
};
