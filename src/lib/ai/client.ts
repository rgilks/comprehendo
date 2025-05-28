import { GoogleGenAI } from '@google/genai';

let genAIClient: GoogleGenAI | null = null;

export const getGoogleAIClient = (): GoogleGenAI => {
  if (genAIClient) {
    return genAIClient;
  }

  const apiKey = process.env['GOOGLE_AI_API_KEY'];

  if (!apiKey) {
    const errorMsg =
      '[GoogleAI Client] CRITICAL: GOOGLE_AI_API_KEY environment variable is not set. Cannot initialize client.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('[GoogleAI Client] Initializing GoogleGenAI client...');
  try {
    genAIClient = new GoogleGenAI({ apiKey });
    return genAIClient;
  } catch (error) {
    console.error('[GoogleAI Client] Failed to initialize GoogleGenAI client:', error);
    throw error;
  }
};
