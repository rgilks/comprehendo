import { describe, it, expect } from 'vitest';
import {
  LanguageSchema,
  LANGUAGES,
  SPEECH_LANGUAGES,
  LearningLanguageSchema,
  LEARNING_LANGUAGES,
  RTL_LANGUAGES,
  getTextDirection,
  SUPPORTED_UI_LANG_CODES,
  UILanguageSchema,
  UI_LANGUAGES,
} from './language';

describe('LanguageSchema', () => {
  it('should parse valid language codes', () => {
    expect(LanguageSchema.safeParse('en').success).toBe(true);
    expect(LanguageSchema.safeParse('zh').success).toBe(true);
  });

  it('should reject invalid language codes', () => {
    expect(LanguageSchema.safeParse('xx').success).toBe(false);
  });
});

describe('LANGUAGES record', () => {
  it('should contain correct language names', () => {
    expect(LANGUAGES.en).toBe('English');
    expect(LANGUAGES.es).toBe('Español');
    expect(LANGUAGES.zh).toBe('中文');
  });
});

describe('SPEECH_LANGUAGES record', () => {
  it('should contain correct speech codes', () => {
    expect(SPEECH_LANGUAGES.en).toBe('en-US');
    expect(SPEECH_LANGUAGES.ja).toBe('ja-JP');
  });
});

describe('LearningLanguageSchema', () => {
  it('should parse valid learning languages', () => {
    expect(LearningLanguageSchema.safeParse('en').success).toBe(true);
    expect(LearningLanguageSchema.safeParse('es').success).toBe(true);
  });

  it('should reject excluded learning languages', () => {
    expect(LearningLanguageSchema.safeParse('zh').success).toBe(false);
    expect(LearningLanguageSchema.safeParse('ja').success).toBe(false);
    expect(LearningLanguageSchema.safeParse('ko').success).toBe(false);
  });

  it('should reject other invalid language codes', () => {
    expect(LearningLanguageSchema.safeParse('xx').success).toBe(false);
  });
});

describe('LEARNING_LANGUAGES record', () => {
  it('should contain allowed learning languages', () => {
    expect(LEARNING_LANGUAGES.en).toBe('English');
    expect(LEARNING_LANGUAGES.fr).toBe('Français');
  });

  it('should not contain excluded learning languages', () => {
    expect(LEARNING_LANGUAGES.zh).toBeUndefined();
    expect(LEARNING_LANGUAGES.ja).toBeUndefined();
    expect(LEARNING_LANGUAGES.ko).toBeUndefined();
  });
});

describe('RTL_LANGUAGES and getTextDirection', () => {
  it('should correctly identify RTL languages', () => {
    expect(RTL_LANGUAGES).toContain('he');
  });

  it('getTextDirection should return "rtl" for Hebrew', () => {
    expect(getTextDirection('he')).toBe('rtl');
  });

  it('getTextDirection should return "ltr" for English', () => {
    expect(getTextDirection('en')).toBe('ltr');
  });

  it('getTextDirection should return "ltr" for Spanish', () => {
    expect(getTextDirection('es')).toBe('ltr');
  });
});

describe('SUPPORTED_UI_LANG_CODES', () => {
  it('should be an array of strings', () => {
    expect(Array.isArray(SUPPORTED_UI_LANG_CODES)).toBe(true);
    expect(SUPPORTED_UI_LANG_CODES.length).toBeGreaterThan(0);
    expect(typeof SUPPORTED_UI_LANG_CODES[0]).toBe('string');
  });
  it('should include common languages like en and es', () => {
    expect(SUPPORTED_UI_LANG_CODES).toContain('en');
    expect(SUPPORTED_UI_LANG_CODES).toContain('es');
  });
});

describe('UILanguageSchema', () => {
  it('should parse valid UI language codes', () => {
    expect(UILanguageSchema.safeParse('en').success).toBe(true);
    expect(UILanguageSchema.safeParse('es').success).toBe(true);
    expect(UILanguageSchema.safeParse('zh').success).toBe(true);
  });

  it('should reject invalid UI language codes', () => {
    // Assuming 'xx' is not in SUPPORTED_UI_LANG_CODES
    expect(UILanguageSchema.safeParse('xx').success).toBe(false);
  });
});

describe('UI_LANGUAGES record', () => {
  it('should contain UI supported languages with correct names', () => {
    expect(UI_LANGUAGES.en).toBe('English');
    expect(UI_LANGUAGES.es).toBe('Español');
    expect(UI_LANGUAGES.zh).toBe('中文');
  });

  it('should only contain languages listed in SUPPORTED_UI_LANG_CODES', () => {
    const uiLangKeys = Object.keys(UI_LANGUAGES);
    expect(uiLangKeys.every((lang) => SUPPORTED_UI_LANG_CODES.includes(lang as any))).toBe(true);
    expect(uiLangKeys.length).toBe(SUPPORTED_UI_LANG_CODES.length);
  });
});
