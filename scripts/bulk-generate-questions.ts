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
): Promise<{ success: boolean; id?: number; error?: string }> => {
  try {
    const genParams = buildGenParams(passageLanguage, questionLanguage, level);
    const options: ExerciseGenerationOptions = { ...genParams, language: passageLanguage };

    console.log(`  Generating: ${passageLanguage}/${level} (${genParams.topic})...`);

    const generatedExercise = await generateAndValidateExercise(options);

    const exerciseId = await saveExercise(
      passageLanguage,
      questionLanguage,
      level,
      JSON.stringify(generatedExercise),
      null
    );

    if (typeof exerciseId !== 'number') {
      return { success: false, error: 'Failed to save exercise (no ID returned)' };
    }

    return { success: true, id: exerciseId };
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
        console.log(
          `  Progress: ${generated}/${targetCount} for this pair | Total: ${stats.total}/${config.totalQuestions}`
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
