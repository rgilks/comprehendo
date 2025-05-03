'use server';

import { z } from 'zod';

// Basic interface for the Google Translate API request payload
interface GoogleTranslatePayload {
  q: string | string[];
  target: string;
  source?: string;
  format?: 'text' | 'html';
}

// Basic interface for the Google Translate API response
interface GoogleTranslateResponse {
  data?: {
    translations?: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
    errors: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

const TranslationResultSchema = z.object({
  translation: z.string(),
  romanization: z.string().optional(), // Romanization might not always be present
});

export type TranslationResult = z.infer<typeof TranslationResultSchema>;

export const translateWordWithGoogle = async (
  word: string,
  targetLang: string,
  sourceLang: string
): Promise<TranslationResult | null> => {
  console.log(`[Translate API] Translating '${word}' from ${sourceLang} to ${targetLang}`);
  if (!word || !targetLang || !sourceLang) {
    console.error('[Translate API] Missing required parameters');
    return null;
  }

  const googleApiKey = process.env.GOOGLE_API_KEY;

  if (!googleApiKey) {
    console.error('Google Translate API key is not configured.');
    // Avoid throwing error directly to client, just return null
    return null;
  }

  const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`;

  const payload: GoogleTranslatePayload = {
    q: word,
    target: targetLang,
    format: 'text',
  };

  if (sourceLang) {
    payload.source = sourceLang;
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as GoogleTranslateResponse;

    if (!response.ok || data.error) {
      console.error(
        'Google Translate API server action error:',
        data.error || `HTTP status ${response.status}`
      );
      return null;
    }

    const translatedText = data.data?.translations?.[0]?.translatedText;

    if (translatedText) {
      const result: TranslationResult = {
        translation: translatedText,
        romanization: '', // Assuming romanization is not provided in the response
      };
      return result;
    } else {
      console.warn('No translation found in Google Translate server action response:', data);
      return null;
    }
  } catch (error: unknown) {
    console.error('Error in Google Translate server action:', error);
    return null;
  }
};
