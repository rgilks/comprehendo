'use server';

import { TranslationResultSchema } from '@/lib/domain/translation';
import { z } from 'zod';

export const translateWordWithGoogle = async (
  word: string,
  targetLang: string,
  sourceLang: string
) => {
  if (!word || !targetLang || !sourceLang) return null;

  const googleApiKey = process.env['GOOGLE_TRANSLATE_API_KEY'];
  if (!googleApiKey) return null;

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
    const data = await response.json();

    if (!response.ok) return null;

    const GoogleTranslateResponseSchema = z.object({
      data: z.object({
        translations: z.array(
          z.object({
            translatedText: z.string(),
          })
        ),
      }),
    });

    const parsedResponse = GoogleTranslateResponseSchema.safeParse(data);

    if (!parsedResponse.success) {
      return null;
    }

    const translations = parsedResponse.data.data.translations;

    if (translations.length === 0) {
      return null;
    }

    const translatedText = translations[0].translatedText;

    return TranslationResultSchema.parse({ translation: translatedText, romanization: '' });
  } catch {
    return null;
  }
};
