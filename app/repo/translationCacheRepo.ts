import { z } from 'zod';
import { eq, and, lt } from 'drizzle-orm';
import getDb from 'app/repo/db';
import { schema } from 'app/lib/db/adapter';

const _TranslationCacheRowSchema = z.object({
  id: z.number(),
  sourceWord: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  translatedText: z.string(),
  createdAt: z.string(),
});

export type TranslationCacheRow = z.infer<typeof _TranslationCacheRowSchema>;

export const getCachedTranslation = async (
  sourceWord: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string | null> => {
  try {
    const db = await getDb();

    const result = await db
      .select({ translatedText: schema.translationCache.translatedText })
      .from(schema.translationCache)
      .where(
        and(
          eq(schema.translationCache.sourceWord, sourceWord.toLowerCase().trim()),
          eq(schema.translationCache.sourceLanguage, sourceLanguage),
          eq(schema.translationCache.targetLanguage, targetLanguage)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0].translatedText;
  } catch (error) {
    console.error('[TranslationCache] Error fetching cached translation:', error);
    return null;
  }
};

export const saveTranslationToCache = async (
  sourceWord: string,
  sourceLanguage: string,
  targetLanguage: string,
  translatedText: string
): Promise<void> => {
  try {
    const db = await getDb();

    await db
      .insert(schema.translationCache)
      .values({
        sourceWord: sourceWord.toLowerCase().trim(),
        sourceLanguage,
        targetLanguage,
        translatedText,
      })
      .onConflictDoUpdate({
        target: [
          schema.translationCache.sourceWord,
          schema.translationCache.sourceLanguage,
          schema.translationCache.targetLanguage,
        ],
        set: {
          translatedText,
          createdAt: new Date().toISOString(),
        },
      });
  } catch (error) {
    console.error('[TranslationCache] Error saving translation to cache:', error);
  }
};

export const cleanupOldTranslations = async (maxAgeDays: number = 30): Promise<void> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    const db = await getDb();

    const result = await db
      .delete(schema.translationCache)
      .where(lt(schema.translationCache.createdAt, cutoffDate.toISOString()));

    console.log(`[TranslationCache] Cleaned up ${result.changes} old translation entries`);
  } catch (error) {
    console.error('[TranslationCache] Error cleaning up old translations:', error);
  }
};
