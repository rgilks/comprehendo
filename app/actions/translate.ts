'use server';

import { TranslationResultSchema } from '@/lib/domain/translation';

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
    if (!response.ok || data.error) return null;
    const translatedText = data.data?.translations?.[0]?.translatedText;
    if (!translatedText) return null;
    return TranslationResultSchema.parse({ translation: translatedText, romanization: '' });
  } catch {
    return null;
  }
};
