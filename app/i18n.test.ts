import { describe, it, expect } from 'vitest';
import { initServerI18n } from './i18n';
import { LanguageSchema } from '@/lib/domain/language';

const testCases = [
  { lang: 'en', expected: 'Comprehendo' },
  { lang: 'fr', expected: 'Comprehendo' },
] as const;

describe('initServerI18n', () => {
  it.each(testCases)(
    'initializes i18n for %s and loads translation',
    async ({ lang, expected }) => {
      LanguageSchema.parse(lang);
      const i18n = await initServerI18n(lang, 'common');
      expect(i18n.language).toBe(lang);
      expect(i18n.t('title')).toBe(expected);
      expect(i18n.hasResourceBundle(lang, 'common')).toBe(true);
    }
  );

  it('loads multiple namespaces if provided', async () => {
    const i18n = await initServerI18n('en', ['common']);
    expect(i18n.hasResourceBundle('en', 'common')).toBe(true);
  });
});
