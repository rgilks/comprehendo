'use server';

import { TranslationResultSchema } from '@/lib/domain/translation';
import { z } from 'zod';

const GoogleTranslateResponseSchema = z.object({
  data: z.object({
    translations: z.array(
      z.object({
        translatedText: z.string(),
      })
    ),
  }),
});

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

    return TranslationResultSchema.parse({ translation: translatedText, romanization: '' });
  } catch (error) {
    console.error('translateWordWithGoogle: Exception during API call or processing:', error);
    return null;
  }
};
