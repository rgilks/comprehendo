import db from 'app/repo/db';
import { z } from 'zod';

const _TranslationCacheRowSchema = z.object({
  id: z.number(),
  source_word: z.string(),
  source_language: z.string(),
  target_language: z.string(),
  translated_text: z.string(),
  created_at: z.string(),
});

export type TranslationCacheRow = z.infer<typeof _TranslationCacheRowSchema>;

export const getCachedTranslation = (
  sourceWord: string,
  sourceLanguage: string,
  targetLanguage: string
): string | null => {
  try {
    const row = db
      .prepare(
        'SELECT translated_text FROM translation_cache WHERE source_word = ? AND source_language = ? AND target_language = ?'
      )
      .get(sourceWord.toLowerCase().trim(), sourceLanguage, targetLanguage) as
      | { translated_text: string }
      | undefined;

    if (!row) {
      return null;
    }

    return row.translated_text;
  } catch (error) {
    console.error('[TranslationCache] Error fetching cached translation:', error);
    return null;
  }
};

export const saveTranslationToCache = (
  sourceWord: string,
  sourceLanguage: string,
  targetLanguage: string,
  translatedText: string
): void => {
  try {
    db.prepare(
      'INSERT OR REPLACE INTO translation_cache (source_word, source_language, target_language, translated_text) VALUES (?, ?, ?, ?)'
    ).run(sourceWord.toLowerCase().trim(), sourceLanguage, targetLanguage, translatedText);
  } catch (error) {
    console.error('[TranslationCache] Error saving translation to cache:', error);
    // Don't throw - caching failure shouldn't break the translation
  }
};

export const cleanupOldTranslations = (maxAgeDays: number = 30): void => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const result = db
      .prepare('DELETE FROM translation_cache WHERE created_at < ?')
      .run(cutoffDate.toISOString());

    console.log(`[TranslationCache] Cleaned up ${result.changes} old translation entries`);
  } catch (error) {
    console.error('[TranslationCache] Error cleaning up old translations:', error);
  }
};
