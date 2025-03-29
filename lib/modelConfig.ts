// Language model configuration
import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Models available for use
export type ModelProvider = "openai" | "google";
export type ModelName = "gpt-3.5-turbo" | "gemini-2.0-flash-lite";

export interface ModelConfig {
  provider: ModelProvider;
  name: ModelName;
  displayName: string;
  maxTokens: number;
}

// Available models
export const MODELS: Record<ModelName, ModelConfig> = {
  "gpt-3.5-turbo": {
    provider: "openai",
    name: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo",
    maxTokens: 500,
  },
  "gemini-2.0-flash-lite": {
    provider: "google",
    name: "gemini-2.0-flash-lite",
    displayName: "Gemini 2.0 Flash-Lite",
    maxTokens: 500,
  },
};

// Create OpenAI client
export const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// Create Google Generative AI client
export const getGoogleAIClient = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    console.warn("Warning: GOOGLE_AI_API_KEY is not set");
  }

  return new GoogleGenerativeAI(apiKey || "");
};

// Get the currently active model from environment variable or default to Gemini 2.0 Flash-Lite
export const getActiveModel = (): ModelConfig => {
  const envModel = process.env.ACTIVE_MODEL;

  // Only use the environment variable if it's a valid model name
  if (envModel && Object.keys(MODELS).includes(envModel)) {
    return MODELS[envModel as ModelName];
  }

  // Default to Gemini 2.0 Flash-Lite as it's cheaper
  return MODELS["gemini-2.0-flash-lite"];
};
