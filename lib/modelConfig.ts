import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

export const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export const getGoogleAIClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.warn('Warning: GOOGLE_AI_API_KEY is not set');
  }

  return new GoogleGenerativeAI(apiKey || '');
};

export const getActiveModel = (): ModelConfig => {
  const envModel = process.env.ACTIVE_MODEL;

  if (envModel && Object.keys(MODELS).includes(envModel)) {
    return MODELS[envModel as ModelName];
  }

  return MODELS['gemini-2.0-flash-lite'];
};
