export type Language =
  | 'zh' // Chinese
  | 'en' // English
  | 'fil' // Filipino
  | 'fr' // French
  | 'de' // German
  | 'el' // Greek
  | 'he' // Hebrew
  | 'hi' // Hindi
  | 'it' // Italian
  | 'ja' // Japanese
  | 'ko' // Korean
  | 'la' // Latin
  | 'pl' // Polish
  | 'pt' // Portuguese
  | 'ru' // Russian
  | 'es' // Spanish
  | 'th'; // Thai

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
  la: 'la-VA',
  pl: 'pl-PL',
  pt: 'pt-PT',
  ru: 'ru-RU',
  es: 'es-ES',
  th: 'th-TH',
};

// Define languages available for learning content
export type LearningLanguage = Exclude<Language, 'zh' | 'ja' | 'ko'>; // Excluded Chinese, Japanese, Korean

export const LEARNING_LANGUAGES: Record<LearningLanguage, string> = {
  // Displaying English names for better usability
  en: 'English',
  fil: 'Filipino',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  it: 'Italian',
  la: 'Latin',
  pl: 'Polish',
  pt: 'Portuguese',
  ru: 'Russian',
  es: 'Spanish',
  th: 'Thai',
};

export const RTL_LANGUAGES: Language[] = ['he'];

export const getTextDirection = (language: Language): 'ltr' | 'rtl' => {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
};
