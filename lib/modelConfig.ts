import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

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

export const MODELS: Record<ModelName, ModelConfig> = {
  'gemini-2.0-flash-lite': {
    provider: 'google',
    name: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash-Lite',
    maxTokens: 500,
  },
  'gemini-2.0-flash': {
    provider: 'google',
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    maxTokens: 500,
  },
  'gemini-2.5-flash-preview-04-17': {
    provider: 'google',
    name: 'gemini-2.5-flash-preview-04-17',
    displayName: 'Gemini 2.5 Flash',
    maxTokens: 500,
  },
};

export const LanguageLevels = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const envSchema = z.object({
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
});

const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(envVars.error.format(), null, 4)
  );
}

const validatedEnv = envVars.success ? envVars.data : {};

export const getGoogleAIClient = () => {
  const apiKey = validatedEnv.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.warn('Warning: GOOGLE_AI_API_KEY is not set or invalid');
  }

  return new GoogleGenerativeAI(apiKey || '');
};

export const getActiveModel = (): ModelConfig => {
  return MODELS['gemini-2.0-flash'];
};
