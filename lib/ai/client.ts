import { GoogleGenAI } from '@google/genai';

// Type definitions related to the AI model configuration
export type ModelProvider = 'google';
export type ModelName =
  | 'gemini-2.0-flash-lite'
  | 'gemini-2.0-flash'
  | 'gemini-2.5-flash-preview-04-17';

export interface ModelConfig {
  provider: ModelProvider;
  name: ModelName;
  displayName: string;
  maxTokens: number;
}

// Define the active model configuration directly
export const ACTIVE_MODEL_CONFIG: ModelConfig = {
  provider: 'google',
  name: 'gemini-2.5-flash-preview-04-17',
  displayName: 'Gemini 2.5 Flash',
  maxTokens: 500, // Default max tokens, adjust if needed
};

// --- Lazy Client Initialization ---
let genAIClient: GoogleGenAI | null = null;

export const getGoogleAIClient = (): GoogleGenAI => {
  // Return existing client if already initialized
  if (genAIClient) {
    return genAIClient;
  }

  // Read API key from environment at runtime
  const apiKey = process.env['GOOGLE_AI_API_KEY'];

  if (!apiKey) {
    const errorMsg =
      '[GoogleAI Client] CRITICAL: GOOGLE_AI_API_KEY environment variable is not set. Cannot initialize client.';
    console.error(errorMsg);
    // Throw an error to prevent proceeding without a key
    throw new Error(errorMsg);
  }

  console.log('[GoogleAI Client] Initializing GoogleGenAI client...');
  try {
    // Note: Consider adding safety settings or other configurations here if needed
    genAIClient = new GoogleGenAI({ apiKey });
    return genAIClient;
  } catch (error) {
    console.error('[GoogleAI Client] Failed to initialize GoogleGenAI client:', error);
    // Re-throw the error to indicate failure
    throw error;
  }
};
