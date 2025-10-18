'use server';

import { TranslationResultSchema } from 'app/domain/translation';
import { z } from 'zod';
import { headers } from 'next/headers';
import {
  getRateLimit,
  incrementRateLimit,
  resetRateLimit,
  createRateLimit,
} from 'app/repo/rateLimitRepo';
import { getCachedTranslation, saveTranslationToCache } from 'app/repo/translationCacheRepo';

const GoogleTranslateResponseSchema = z.object({
  data: z.object({
    translations: z.array(
      z.object({
        translatedText: z.string(),
      })
    ),
  }),
});

const MAX_TRANSLATION_REQUESTS_PER_HOUR = parseInt(
  process.env['RATE_LIMIT_MAX_TRANSLATION_REQUESTS_PER_HOUR'] || '200',
  10
);
const RATE_LIMIT_WINDOW = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '3600000', 10);

const checkTranslationRateLimit = async (ip: string): Promise<boolean> => {
  try {
    const now = Date.now();
    const rateLimitRow = await getRateLimit(ip);

    if (!rateLimitRow) {
      await createRateLimit(ip, new Date(now).toISOString());
      return true;
    }

    const windowStartTime = new Date(rateLimitRow.windowStartTime).getTime();
    const isWithinWindow = now - windowStartTime < RATE_LIMIT_WINDOW;

    if (isWithinWindow) {
      if (rateLimitRow.requestCount >= MAX_TRANSLATION_REQUESTS_PER_HOUR) {
        return false;
      }
      await incrementRateLimit(ip);
      return true;
    }

    await resetRateLimit(ip, new Date(now).toISOString());
    return true;
  } catch (error) {
    console.error('[Translation RateLimiter] Error checking rate limit:', error);
    return false;
  }
};

export const translateWordWithGoogle = async (
  word: string,
  targetLang: string,
  sourceLang: string
) => {
  const googleApiKey = process.env['GOOGLE_TRANSLATE_API_KEY'];

  if (!word || !targetLang || !sourceLang || !googleApiKey) {
    console.error('translateWordWithGoogle: Missing required parameters or API key.');
    return null;
  }

  // Check cache first
  const cachedTranslation = await getCachedTranslation(word, sourceLang, targetLang);
  if (cachedTranslation) {
    console.log(`[Translation] Cache hit for "${word}" (${sourceLang} -> ${targetLang})`);
    return TranslationResultSchema.parse({ translation: cachedTranslation, romanization: '' });
  }

  // Check rate limit for translation requests
  const headersList = await headers();
  const ip = headersList.get('fly-client-ip') || headersList.get('x-forwarded-for') || 'unknown';

  if (!(await checkTranslationRateLimit(ip))) {
    console.warn(`[Translation] Rate limit exceeded for IP: ${ip}`);
    return null;
  }

  const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`;

  const payload = {
    q: word,
    target: targetLang,
    format: 'text',
    source: sourceLang,
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`translateWordWithGoogle: API request failed with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const parsedResponse = GoogleTranslateResponseSchema.safeParse(data);

    if (!parsedResponse.success) {
      console.error('translateWordWithGoogle: Failed to parse API response:', parsedResponse.error);
      return null;
    }

    const translatedText = parsedResponse.data.data.translations[0]?.translatedText;

    if (!translatedText) {
      console.error('translateWordWithGoogle: No translated text found in API response.');
      return null;
    }

    // Save to cache for future use
    await saveTranslationToCache(word, sourceLang, targetLang, translatedText);
    console.log(`[Translation] Cached translation for "${word}" (${sourceLang} -> ${targetLang})`);

    return TranslationResultSchema.parse({ translation: translatedText, romanization: '' });
  } catch (error) {
    console.error('translateWordWithGoogle: Exception during API call or processing:', error);
    return null;
  }
};
