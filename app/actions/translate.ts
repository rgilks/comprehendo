'use server';

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

/**
 * Translates a word using the Google Cloud Translation API.
 * This is a Server Action and runs only on the server.
 * @param word The word or text to translate.
 * @param targetLang The target language code (e.g., 'es', 'fr').
 * @param sourceLang The source language code (optional, Google can auto-detect).
 * @returns The translated text or null if translation fails.
 */
export async function translateWordWithGoogle(
  word: string,
  targetLang: string,
  sourceLang?: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

  if (!apiKey) {
    console.error('Google Translate API key is not configured.');
    // Avoid throwing error directly to client, just return null
    return null;
  }

  if (!word || !targetLang) {
    console.error('Missing required parameters for translation.');
    return null;
  }

  const apiUrl = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

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
      return translatedText;
    } else {
      console.warn('No translation found in Google Translate server action response:', data);
      return null;
    }
  } catch (error: unknown) {
    console.error('Error in Google Translate server action:', error);
    return null;
  }
}
