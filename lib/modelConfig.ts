import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

export type ModelProvider = 'openai' | 'google';
export type ModelName = 'gpt-3.5-turbo' | 'gemini-2.0-flash-lite';

export interface ModelConfig {
  provider: ModelProvider;
  name: ModelName;
  displayName: string;
  maxTokens: number;
}

export const MODELS: Record<ModelName, ModelConfig> = {
  'gpt-3.5-turbo': {
    provider: 'openai',
    name: 'gpt-3.5-turbo',
    displayName: 'GPT-3.5 Turbo',
    maxTokens: 500,
  },
  'gemini-2.0-flash-lite': {
    provider: 'google',
    name: 'gemini-2.0-flash-lite',
    displayName: 'Gemini 2.0 Flash-Lite',
    maxTokens: 500,
  },
};

// --- Zod Schema for Environment Variables ---
const envSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  ACTIVE_MODEL: z.enum(Object.keys(MODELS) as [ModelName, ...ModelName[]]).optional(),
});

// Parse and validate environment variables at startup
const envVars = envSchema.safeParse(process.env);

if (!envVars.success) {
  console.error(
    '❌ Invalid environment variables:',
    JSON.stringify(envVars.error.format(), null, 4)
  );
  // Decide how to handle this - throw error, exit, or use defaults
  // For now, let's log and proceed cautiously, functions might fail if keys are missing
}

const validatedEnv = envVars.success ? envVars.data : {};
// --- End Zod Schema ---

export const getOpenAIClient = () => {
  // Use validated env var
  if (!validatedEnv.OPENAI_API_KEY) {
    console.warn('Warning: OPENAI_API_KEY is not set or invalid');
    // Potentially throw an error or return a mock client depending on desired behavior
  }
  return new OpenAI({
    apiKey: validatedEnv.OPENAI_API_KEY || '',
  });
};

export const getGoogleAIClient = () => {
  const apiKey = validatedEnv.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.warn('Warning: GOOGLE_AI_API_KEY is not set or invalid');
  }

  return new GoogleGenerativeAI(apiKey || '');
};

export const getActiveModel = (): ModelConfig => {
  const envModel = validatedEnv.ACTIVE_MODEL;

  if (envModel) {
    return MODELS[envModel];
  }

  // Return default if ACTIVE_MODEL is not set or invalid
  console.warn(
    `Warning: ACTIVE_MODEL env var is not set or invalid. Falling back to default: ${MODELS['gemini-2.0-flash-lite'].displayName}`
  );
  return MODELS['gemini-2.0-flash-lite'];
};
