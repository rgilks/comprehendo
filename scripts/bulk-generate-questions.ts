#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as schema from '../app/lib/db/schema';
import { initializeSchema } from '../app/lib/db/migrations';
import {
  generateAndValidateExercise,
  type ExerciseGenerationOptions,
} from '../app/lib/ai/exercise-generator';
import { type ExerciseGenerationParams } from '../app/domain/ai';
import { getRandomTopicForLevel } from '../app/domain/topics';
import {
  getGrammarGuidance,
  getVocabularyGuidance,
  type CEFRLevel,
  CEFR_LEVELS,
} from '../app/domain/language-guidance';
import { LANGUAGES, type Language } from '../app/domain/language';
import { saveExercise } from '../app/repo/quizRepo';
import { GoogleGenAI } from '@google/genai';
import { getGoogleAIClient } from '../app/lib/ai/client';
import { generateExercisePrompt } from '../app/lib/ai/prompts/exercise-prompt';
import { ExerciseContent, ExerciseContentSchema } from '../app/domain/schemas';
import { z } from 'zod';
import { AIResponseProcessingError } from '../app/lib/ai/google-ai-api';

interface GenerationConfig {
  totalQuestions: number;
  languages: Language[];
  levels: CEFRLevel[];
  questionLanguage: Language;
  delayBetweenRequests: number;
  batchSize: number;
  maxDailyRequests?: number | undefined;
  resumeFrom?:
    | {
        language: Language;
        level: CEFRLevel;
        count: number;
      }
    | undefined;
}

const DB_DIR = process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'comprehendo.sqlite');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface TokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GenerationResult {
  success: boolean;
  id?: number;
  error?: string;
  tokenUsage?: TokenUsage;
}

interface CostTracking {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  requestCount: number;
}

const GEMINI_FLASH_PRICING = {
  inputTokensPerMillion: 0.30,
  outputTokensPerMillion: 2.50,
};

const calculateCost = (inputTokens: number, outputTokens: number): number => {
  const inputCost = (inputTokens / 1_000_000) * GEMINI_FLASH_PRICING.inputTokensPerMillion;
  const outputCost = (outputTokens / 1_000_000) * GEMINI_FLASH_PRICING.outputTokensPerMillion;
  return inputCost + outputCost;
};

const callGoogleAIWithUsage = async (
  prompt: string
): Promise<{ content: unknown; usage: TokenUsage }> => {
  const genAI: GoogleGenAI = getGoogleAIClient();

  const generationConfig = {
    maxOutputTokens: 500,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
    candidateCount: 1,
    responseMimeType: 'application/json',
  };

  const modelName = process.env['GOOGLE_AI_GENERATION_MODEL'] ?? 'gemini-2.5-flash';

  const request = {
    model: modelName,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: generationConfig,
  };

  const result = await genAI.models.generateContent(request);

  const text: string | undefined = result.text;

  if (text === undefined) {
    throw new AIResponseProcessingError(
      'No content received from Google AI or failed to extract text.'
    );
  }

  const usage = (result as { usage?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } }).usage;
  
  const tokenUsage: TokenUsage = {
    promptTokenCount: usage?.promptTokenCount ?? 0,
    candidatesTokenCount: usage?.candidatesTokenCount ?? 0,
    totalTokenCount: usage?.totalTokenCount ?? 0,
  };
  
  if (tokenUsage.totalTokenCount === 0 && tokenUsage.promptTokenCount === 0) {
    console.warn('[Cost Tracking] Warning: No token usage data in API response, cost tracking may be inaccurate');
  }

  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonRegex);
  let potentialJsonString: string;

  if (match && match[1]) {
    potentialJsonString = match[1].trim();
  } else {
    const trimmedText = text.trim();
    if (
      (trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
      (trimmedText.startsWith('[') && trimmedText.endsWith(']'))
    ) {
      potentialJsonString = trimmedText;
    } else {
      throw new AIResponseProcessingError(
        'AI response received, but failed to extract valid JSON content.'
      );
    }
  }

  try {
    const parsedJson = JSON.parse(potentialJsonString);
    return { content: parsedJson, usage: tokenUsage };
  } catch (parseError) {
    throw new AIResponseProcessingError('Failed to parse JSON from AI response.', parseError);
  }
};

const buildGenParams = (
  passageLanguage: Language,
  questionLanguage: Language,
  level: CEFRLevel,
  topic?: string
): ExerciseGenerationParams => ({
  passageLanguage,
  questionLanguage,
  level,
  passageLangName: LANGUAGES[passageLanguage],
  questionLangName: LANGUAGES[questionLanguage],
  topic: topic || getRandomTopicForLevel(level),
  grammarGuidance: getGrammarGuidance(level),
  vocabularyGuidance: getVocabularyGuidance(level),
});

const generateSingleQuestion = async (
  _db: ReturnType<typeof drizzle>,
  passageLanguage: Language,
  questionLanguage: Language,
  level: CEFRLevel
): Promise<GenerationResult> => {
  try {
    const genParams = buildGenParams(passageLanguage, questionLanguage, level);

    console.log(`  Generating: ${passageLanguage}/${level} (${genParams.topic})...`);

    const prompt = generateExercisePrompt(genParams);
    const { content: aiResponse, usage: tokenUsage } = await callGoogleAIWithUsage(prompt);

    if (typeof aiResponse !== 'object' || aiResponse === null) {
      return {
        success: false,
        error: 'AI response was not a valid object',
        tokenUsage,
      };
    }

    const parsedAiContent = aiResponse as Record<string, unknown>;
    const validationResult = ExerciseContentSchema.safeParse(parsedAiContent);

    if (!validationResult.success) {
      return {
        success: false,
        error: `Validation failed: ${validationResult.error.message}`,
        tokenUsage,
      };
    }

    const generatedExercise = validationResult.data;

    const exerciseId = await saveExercise(
      passageLanguage,
      questionLanguage,
      level,
      JSON.stringify(generatedExercise),
      null
    );

    if (typeof exerciseId !== 'number') {
      return {
        success: false,
        error: 'Failed to save exercise (no ID returned)',
        tokenUsage,
      };
    }

    return { success: true, id: exerciseId, tokenUsage };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
};

const bulkGenerate = async (config: GenerationConfig) => {
  console.log('='.repeat(60));
  console.log('Bulk Question Generation Script');
  console.log('='.repeat(60));
  console.log(`Total questions to generate: ${config.totalQuestions}`);
  console.log(`Languages: ${config.languages.join(', ')}`);
  console.log(`Levels: ${config.levels.join(', ')}`);
  console.log(`Question language: ${config.questionLanguage}`);
  console.log(`Delay between requests: ${config.delayBetweenRequests}ms`);
  console.log(`Batch size: ${config.batchSize}`);
  console.log('='.repeat(60));

  if (!process.env['GOOGLE_AI_API_KEY']) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is required');
  }

  const sqlite = new Database(DB_PATH);
  const db = drizzle(sqlite, { schema });
  initializeSchema(db as unknown as Parameters<typeof initializeSchema>[0]);

  const stats = {
    total: 0,
    successful: 0,
    failed: 0,
    byLanguage: {} as Record<string, { success: number; failed: number }>,
    byLevel: {} as Record<string, { success: number; failed: number }>,
  };

  const costTracking: CostTracking = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    requestCount: 0,
  };

  const languageLevelPairs: Array<{ language: Language; level: CEFRLevel }> = [];

  for (const language of config.languages) {
    for (const level of config.levels) {
      languageLevelPairs.push({ language, level });
    }
  }

  let questionsPerPair = Math.ceil(config.totalQuestions / languageLevelPairs.length);
  let remainingQuestions = config.totalQuestions;
  let pairIndex = 0;

  if (config.resumeFrom) {
    const resumeFrom = config.resumeFrom;
    const resumePair = languageLevelPairs.findIndex(
      (p) => p.language === resumeFrom.language && p.level === resumeFrom.level
    );
    if (resumePair >= 0) {
      pairIndex = resumePair;
      const resumeCount = resumeFrom.count;
      questionsPerPair = Math.ceil(
        (config.totalQuestions - resumeCount) / (languageLevelPairs.length - pairIndex)
      );
    }
  }

  const modelName = process.env['GOOGLE_AI_GENERATION_MODEL'] ?? 'gemini-2.5-flash';
  console.log(`Using model: ${modelName}`);
  console.log(
    `Pricing: $${GEMINI_FLASH_PRICING.inputTokensPerMillion}/M input tokens, $${GEMINI_FLASH_PRICING.outputTokensPerMillion}/M output tokens`
  );
  console.log(
    `\nStarting generation for ${languageLevelPairs.length} language/level combinations...\n`
  );

  for (
    let i = pairIndex;
    i < languageLevelPairs.length && stats.total < config.totalQuestions;
    i++
  ) {
    const { language, level } = languageLevelPairs[i] as { language: Language; level: CEFRLevel };
    const pairKey = `${language}/${level}`;

    stats.byLanguage[language] = stats.byLanguage[language] ?? { success: 0, failed: 0 };
    stats.byLevel[level] = stats.byLevel[level] ?? { success: 0, failed: 0 };

    let targetCount = Math.min(questionsPerPair, remainingQuestions);
    let generated = 0;

    if (config.resumeFrom && i === pairIndex && config.resumeFrom.count) {
      generated = config.resumeFrom.count;
      targetCount -= generated;
    }

    console.log(`\n[${i + 1}/${languageLevelPairs.length}] Generating for ${pairKey}`);
    console.log(`  Target: ${targetCount} questions (already generated: ${generated})`);

    while (generated < targetCount && stats.total < config.totalQuestions) {
      const batchPromises: Promise<void>[] = [];
      const batchSize = Math.min(
        config.batchSize,
        targetCount - generated,
        config.totalQuestions - stats.total
      );

      for (let j = 0; j < batchSize; j++) {
        batchPromises.push(
          (async () => {
            const result = await generateSingleQuestion(
              db,
              language,
              config.questionLanguage,
              level
            );
            stats.total++;
            costTracking.requestCount++;

            if (result.tokenUsage) {
              costTracking.totalInputTokens += result.tokenUsage.promptTokenCount;
              costTracking.totalOutputTokens += result.tokenUsage.candidatesTokenCount;
              const requestCost = calculateCost(
                result.tokenUsage.promptTokenCount,
                result.tokenUsage.candidatesTokenCount
              );
              costTracking.totalCost += requestCost;
            }

            if (result.success) {
              stats.successful++;
              stats.byLanguage[language].success++;
              stats.byLevel[level].success++;
              generated++;
            } else {
              stats.failed++;
              stats.byLanguage[language].failed++;
              stats.byLevel[level].failed++;
            }
          })()
        );

        if (j < batchSize - 1) {
          await sleep(config.delayBetweenRequests);
        }
      }

      await Promise.all(batchPromises);

      if (stats.total < config.totalQuestions && generated < targetCount) {
        const avgCostPerQuestion = costTracking.requestCount > 0
          ? costTracking.totalCost / costTracking.requestCount
          : 0;
        const estimatedRemaining = (config.totalQuestions - stats.total) * avgCostPerQuestion;
        console.log(
          `  Progress: ${generated}/${targetCount} for this pair | Total: ${stats.total}/${config.totalQuestions}`
        );
        console.log(
          `  Cost so far: $${costTracking.totalCost.toFixed(4)} | Est. remaining: $${estimatedRemaining.toFixed(4)}`
        );
        await sleep(config.delayBetweenRequests * 2);
      }
    }

    remainingQuestions -= generated;
    console.log(`  Completed ${pairKey}: ${generated} questions generated`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));
  console.log(`Total generated: ${stats.total}`);
  console.log(`Successful: ${stats.successful}`);
  console.log(`Failed: ${stats.failed}`);
  console.log('\nBy Language:');
  for (const [lang, counts] of Object.entries(stats.byLanguage)) {
    console.log(`  ${lang}: ${counts.success} success, ${counts.failed} failed`);
  }
  console.log('\nBy Level:');
  for (const [level, counts] of Object.entries(stats.byLevel)) {
    console.log(`  ${level}: ${counts.success} success, ${counts.failed} failed`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Cost Summary');
  console.log('-'.repeat(60));
  console.log(`Total API Requests: ${costTracking.requestCount}`);
  console.log(`Total Input Tokens: ${costTracking.totalInputTokens.toLocaleString()}`);
  console.log(`Total Output Tokens: ${costTracking.totalOutputTokens.toLocaleString()}`);
  console.log(`Total Tokens: ${(costTracking.totalInputTokens + costTracking.totalOutputTokens).toLocaleString()}`);
  console.log(`\nTotal Cost: $${costTracking.totalCost.toFixed(4)}`);
  
  if (stats.successful > 0) {
    const costPerSuccess = costTracking.totalCost / stats.successful;
    const tokensPerSuccess =
      (costTracking.totalInputTokens + costTracking.totalOutputTokens) / stats.successful;
    console.log(`Cost per successful question: $${costPerSuccess.toFixed(4)}`);
    console.log(`Tokens per successful question: ${tokensPerSuccess.toFixed(0)}`);
  }

  const inputCost = (costTracking.totalInputTokens / 1_000_000) * GEMINI_FLASH_PRICING.inputTokensPerMillion;
  const outputCost = (costTracking.totalOutputTokens / 1_000_000) * GEMINI_FLASH_PRICING.outputTokensPerMillion;
  console.log(`\nCost Breakdown:`);
  console.log(`  Input tokens: $${inputCost.toFixed(4)} (${costTracking.totalInputTokens.toLocaleString()} tokens)`);
  console.log(`  Output tokens: $${outputCost.toFixed(4)} (${costTracking.totalOutputTokens.toLocaleString()} tokens)`);

  console.log('='.repeat(60));

  sqlite.close();
};

const config: GenerationConfig = {
  totalQuestions: parseInt(process.env['TOTAL_QUESTIONS'] || '100', 10),
  languages: (process.env['LANGUAGES']?.split(',') || ['es', 'fr', 'de', 'it']).filter(
    (l): l is Language =>
      [
        'zh',
        'en',
        'fil',
        'fr',
        'de',
        'el',
        'he',
        'hi',
        'it',
        'ja',
        'ko',
        'pl',
        'pt',
        'ru',
        'es',
        'th',
      ].includes(l)
  ),
  levels: (process.env['LEVELS']?.split(',') || ['A1', 'A2', 'B1', 'B2']).filter(
    (l): l is CEFRLevel => CEFR_LEVELS.includes(l as CEFRLevel)
  ),
  questionLanguage: (process.env['QUESTION_LANGUAGE'] || 'en') as Language,
  delayBetweenRequests: parseInt(process.env['DELAY_MS'] || '2000', 10),
  batchSize: parseInt(process.env['BATCH_SIZE'] || '5', 10),
  maxDailyRequests: process.env['MAX_DAILY_AI_REQUESTS']
    ? parseInt(process.env['MAX_DAILY_AI_REQUESTS'], 10)
    : undefined,
};

if (require.main === module) {
  bulkGenerate(config)
    .then(() => {
      console.log('\nScript completed successfully');
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

export { bulkGenerate };
