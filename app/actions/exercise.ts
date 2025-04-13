'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { getActiveModel, getGoogleAIClient, openai, ModelConfig } from '@/lib/modelConfig';
import { LANGUAGES, type Language } from '@/contexts/LanguageContext';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import { QuizDataSchema, GenerateExerciseResult, type PartialQuizData } from '@/lib/domain/schemas';
import * as Sentry from '@sentry/nextjs';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

interface RateLimitRow {
  requests: string;
  updated_at: string;
  id: number;
}

interface QuizRow {
  id: number;
  language: string;
  level: string;
  content: string;
  created_at: string;
  question_language: string | null;
}

const _exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof _exerciseRequestBodySchema>;

class AIResponseProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

function ensureError(error: unknown, defaultMessage: string = 'An unknown error occurred'): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(`${defaultMessage}: ${String(error)}`);
}

export const checkRateLimit = async (ip: string): Promise<boolean> => {
  if (!db) throw new Error('Database not initialized');

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_address TEXT PRIMARY KEY,
        requests TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const now = Date.now();
    let userRequests: number[] = [];

    console.log(`[API] Checking rate limit for IP: ${ip}`);
    console.log(`[API Perf] Rate Limit - SELECT Start: ${Date.now()}`);
    const rateLimitRow = db
      .prepare('SELECT requests, updated_at FROM rate_limits WHERE ip_address = ?')
      .get(ip) as RateLimitRow | undefined;
    console.log(`[API Perf] Rate Limit - SELECT End: ${Date.now()}`);

    if (rateLimitRow) {
      try {
        const parsedRequests: unknown = JSON.parse(rateLimitRow.requests);
        if (
          Array.isArray(parsedRequests) &&
          parsedRequests.every((item) => typeof item === 'number')
        ) {
          userRequests = parsedRequests;
        } else {
          console.warn(`[API] Invalid rate limit data found for IP ${ip}. Resetting.`);
          userRequests = [];
        }
      } catch (parseError) {
        console.error(`[API] Failed to parse rate limit data for IP ${ip}:`, parseError);
        Sentry.captureException(parseError);
        userRequests = [];
      }
      console.log(`[API] Found ${userRequests.length} previous requests for IP: ${ip}`);
    }

    const recentRequests = userRequests.filter(
      (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
    );
    console.log(`[API] ${recentRequests.length} recent requests for IP: ${ip}`);

    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.log(`[API] Rate limit exceeded for IP: ${ip}`);
      return false;
    }

    const updatedRequests = [...recentRequests, now];
    console.log(`[API] Updating rate limit for IP: ${ip} with ${updatedRequests.length} requests`);

    console.log(`[API Perf] Rate Limit - INSERT/UPDATE Start: ${Date.now()}`);
    db.prepare(
      `
      INSERT INTO rate_limits (ip_address, requests, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip_address) DO UPDATE SET
      requests = ?, updated_at = CURRENT_TIMESTAMP
    `
    ).run(ip, JSON.stringify(updatedRequests), JSON.stringify(updatedRequests));
    console.log(`[API Perf] Rate Limit - INSERT/UPDATE End: ${Date.now()}`);

    return true;
  } catch (error) {
    console.error('[API] Error checking rate limit:', error);
    Sentry.captureException(error);
    return false;
  }
};

export const getCachedExercise = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): Promise<QuizRow | undefined> => {
  if (!db) throw new Error('Database not initialized');
  console.log('[API] Logged-in user or non-A1 level: Checking database cache.');
  try {
    const getCachedContent = (specificLevel: string) => {
      const stmt = db.prepare<[string, string, string]>(
        `SELECT id, language, level, content, created_at, question_language
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ORDER BY created_at DESC LIMIT 1`
      );
      return stmt.get(passageLanguage, questionLanguage, specificLevel) as QuizRow | undefined;
    };

    const cachedContent = getCachedContent(level);

    return cachedContent;
  } catch (error) {
    console.error('[API] Error getting cached exercise:', error);
    Sentry.captureException(error);
    return undefined;
  }
};

export const saveExerciseToCache = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  jsonContent: string,
  userId: number | null
): Promise<number | undefined> => {
  if (!db) throw new Error('Database not initialized');
  console.log(
    `[API] Attempting to save exercise to cache. Params: lang=${passageLanguage}, qLang=${questionLanguage}, level=${level}, userId=${userId}`
  );
  try {
    const result = db
      .prepare(
        `
        INSERT INTO quiz (language, question_language, level, content, created_at, user_id)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        RETURNING id
      `
      )
      .get(passageLanguage, questionLanguage, level, jsonContent, userId) as
      | { id: number }
      | undefined;

    if (result?.id) {
      console.log(`[API] Saved exercise to cache with ID: ${result.id}`);
      return result.id;
    } else {
      console.error(
        '[API] Failed to get ID after saving to cache. The insert might have failed silently or RETURNING id did not work as expected.'
      );
      return undefined;
    }
  } catch (error) {
    console.error('[API] Error saving to cache during DB operation:', error);
    Sentry.captureException(error);
    return undefined;
  }
};

async function callOpenAI(prompt: string, modelConfig: ModelConfig): Promise<string> {
  console.log('[API] Calling OpenAI API...');
  if (!openai) {
    throw new Error('OpenAI client is not initialized. Check OPENAI_API_KEY.');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: modelConfig.name,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: modelConfig.maxTokens,
    });

    const choice = completion?.choices?.[0];
    const result = choice?.message?.content;

    if (!result) {
      if (!completion) console.error('[API] OpenAI response completion object is missing.');
      else if (!completion.choices || completion.choices.length === 0)
        console.error('[API] OpenAI response choices array is missing or empty.');
      else if (!choice.message) console.error('[API] OpenAI response message object is missing.');
      else if (!choice.message.content)
        console.error('[API] OpenAI response message content is missing.');

      throw new AIResponseProcessingError('No content received or invalid structure from OpenAI');
    }
    console.log('[API] Received response from OpenAI.');
    return result;
  } catch (error: unknown) {
    console.error('[API] OpenAI API raw error:', String(error));
    const wrappedError = ensureError(error, 'Failed to generate content using OpenAI');
    Sentry.captureException(wrappedError);
    throw wrappedError;
  }
}

async function callGoogleAI(prompt: string, modelConfig: ModelConfig): Promise<string> {
  console.log('[API] Calling Google AI API...');
  const genAI = getGoogleAIClient();
  if (!genAI) throw new Error('Google AI client not initialized');

  try {
    const model = genAI.getGenerativeModel({
      model: modelConfig.name,
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: modelConfig.maxTokens,
      },
    });

    const result = await model.generateContent(prompt);
    const response = result?.response;
    const text = response?.text();

    if (!text) {
      if (!result) console.error('[API] Google AI result object is missing.');
      else if (!response) console.error('[API] Google AI response object is missing.');
      else console.error('[API] Google AI response text is missing or empty.');

      throw new AIResponseProcessingError(
        'No content received or invalid structure from Google AI'
      );
    }
    console.log('[API] Received response from Google AI.');
    return text;
  } catch (error: unknown) {
    console.error('[API] Google AI API raw error:', String(error));
    const wrappedError = ensureError(error, 'Failed to generate content using Google AI');
    Sentry.captureException(wrappedError);
    throw wrappedError;
  }
}

export const generateExerciseResponse = async (
  params: ExerciseRequestParams
): Promise<GenerateExerciseResult> => {
  console.log('[API] generateExerciseResponse called with params:', params);
  const start = Date.now();
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session = await getServerSession();
  const userId = session?.user?.dbId || null;

  const { passageLanguage, questionLanguage, cefrLevel: level } = params;

  const passageLanguageStr = String(passageLanguage);
  const questionLanguageStr = String(questionLanguage);
  const levelStr = String(level);

  const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  if (!validCefrLevels.includes(levelStr as CEFRLevel)) {
    console.error(`[API] Invalid CEFR level received: ${levelStr}`);
    return {
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      error: `Invalid CEFR level: ${levelStr}`,
    };
  }
  const cefrLevelTyped = levelStr as CEFRLevel;

  const topicResult = getRandomTopicForLevel(cefrLevelTyped);
  let topic;
  if (typeof topicResult === 'string') {
    topic = topicResult;
  } else {
    topic = String(topicResult);
  }

  const grammarGuidance: string = getGrammarGuidance(cefrLevelTyped);
  const vocabularyGuidance: string = getVocabularyGuidance(cefrLevelTyped);
  const passageLangName: string = LANGUAGES[passageLanguageStr as Language] ?? passageLanguageStr;
  const questionLangName: string =
    LANGUAGES[questionLanguageStr as Language] ?? questionLanguageStr;

  console.log(
    `[API] Received request: lang=${passageLanguageStr}, qLang=${questionLanguageStr}, level=${levelStr}, ip=${ip}, userId=${userId}`
  );

  console.log(`[API Perf] Rate Limit Check Start: ${Date.now()}`);
  if (!(await checkRateLimit(ip))) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}`);
    return {
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      error: 'Rate limit exceeded',
    };
  }
  console.log(`[API Perf] Rate Limit Check End: ${Date.now()}`);

  console.log(`[API Perf] Cache Check Start: ${Date.now()}`);
  const cachedExercise = await getCachedExercise(passageLanguage, questionLanguage, level);
  console.log(`[API Perf] Cache Check End: ${Date.now()}`);

  if (cachedExercise) {
    console.log(
      `[API] Cache hit for lang=${passageLanguage}, level=${level}. Cache ID: ${cachedExercise.id}`
    );
    try {
      console.log(`[API Perf] Cache Validation Start: ${Date.now()}`);
      const parsedCachedContent = JSON.parse(cachedExercise.content);
      const validatedCachedData = QuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error('[API] Invalid data found in cache:', validatedCachedData.error.format());
        return {
          quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
          quizId: -1,
          error: 'Invalid cached data encountered.',
        };
      }
      console.log(`[API Perf] Cache Validation End: ${Date.now()}`);

      const fullData = validatedCachedData.data;

      const partialData: PartialQuizData = {
        paragraph: fullData.paragraph,
        question: fullData.question,
        options: fullData.options,
        topic: fullData.topic,
      };
      return {
        quizData: partialData,
        quizId: cachedExercise.id,
        cached: true,
      };
    } catch (error) {
      console.error('[API] Error processing cached exercise:', error);
    }
  } else {
    console.log(`[API] Cache miss for lang=${passageLanguage}, level=${level}`);
  }

  let aiResponseContent: string | undefined;
  let validatedAiData: z.infer<typeof QuizDataSchema> | undefined;

  try {
    const activeModel = getActiveModel();
    console.log(`[API] Using AI model: ${activeModel.displayName}`);

    const prompt = `Generate a reading comprehension exercise based on the following parameters:
- Topic: ${topic}
- Passage Language: ${passageLangName} (${passageLanguageStr})
- Question Language: ${questionLangName} (${questionLanguageStr})
- CEFR Level: ${levelStr}
- Grammar Guidance: ${grammarGuidance}
- Vocabulary Guidance: ${vocabularyGuidance}

Instructions:
1. Create a short paragraph (3-6 sentences) in ${passageLanguageStr} suitable for a ${levelStr} learner, focusing on the topic "${topic}".
2. Write one multiple-choice question in ${questionLanguageStr} about the main idea or a specific detail of the paragraph.
3. Provide four answer options (A, B, C, D) in ${questionLanguageStr}. Only one option should be correct. The options should be plausible but clearly distinguishable based on the paragraph.
4. Identify the correct answer (A, B, C, or D).
5. Provide a brief explanation (in ${questionLanguageStr}) for why each option is correct or incorrect.
6. Extract the specific sentence or phrase from the original paragraph (in ${passageLanguageStr}) that provides the evidence for the correct answer ("relevantText").

Output Format: Respond ONLY with a valid JSON object containing the following keys:
- "paragraph": (string) The generated paragraph in ${passageLanguageStr}.
- "topic": (string) The topic used: "${topic}".
- "question": (string) The multiple-choice question in ${questionLanguageStr}.
- "options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in ${questionLanguageStr}.
- "correctAnswer": (string) The key ("A", "B", "C", or "D") of the correct answer.
- "explanations": (object) An object with keys "A", "B", "C", "D", where each value is the explanation string in ${questionLanguageStr} for that option.
- "relevantText": (string) The sentence or phrase from the paragraph in ${passageLanguageStr} that supports the correct answer.

Example JSON structure:
{
  "paragraph": "...",
  "topic": "...",
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": "B",
  "explanations": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "relevantText": "..."
}

Ensure the entire output is a single, valid JSON object string without any surrounding text or markdown formatting.
`;

    console.log(`[API Perf] AI Call Start: ${Date.now()}`);
    if (activeModel.provider === 'openai') {
      aiResponseContent = await callOpenAI(prompt, activeModel);
    } else if (activeModel.provider === 'google') {
      aiResponseContent = await callGoogleAI(prompt, activeModel);
    } else {
      throw new Error(`Unsupported model provider: ${activeModel.provider}`);
    }
    console.log(`[API Perf] AI Call End: ${Date.now()}`);

    if (!aiResponseContent) {
      throw new AIResponseProcessingError('Received empty response from AI model.');
    }

    console.log(`[API Perf] AI Response Validation Start: ${Date.now()}`);
    let parsedAiContent: unknown;
    try {
      parsedAiContent = JSON.parse(aiResponseContent);
    } catch (parseError: unknown) {
      console.error(
        '[API] Failed to parse AI response JSON:',
        parseError,
        '\nRaw Response:\n',
        aiResponseContent
      );
      const errorToCapture = ensureError(parseError, 'Failed to parse AI response JSON');
      Sentry.captureException(errorToCapture, { extra: { aiResponseContent } });
      throw new AIResponseProcessingError(
        `Failed to parse AI JSON response. Error: ${errorToCapture.message}`
      );
    }

    const validationResult = QuizDataSchema.safeParse(parsedAiContent);

    if (!validationResult.success) {
      console.error(
        '[API] AI response failed Zod validation:',
        JSON.stringify(validationResult.error.format(), null, 2)
      );
      console.error('[API] Failing AI Response Content:', aiResponseContent);
      throw new AIResponseProcessingError(
        `AI response failed validation. Errors: ${JSON.stringify(validationResult.error.format())}`
      );
    }
    validatedAiData = validationResult.data;
    console.log(`[API Perf] AI Response Validation End: ${Date.now()}`);

    console.log(`[API Perf] Cache Save Start: ${Date.now()}`);
    const currentUserId = userId;
    const quizId = await saveExerciseToCache(
      passageLanguage,
      questionLanguage,
      level,
      aiResponseContent,
      currentUserId
    );
    console.log(`[API Perf] Cache Save End: ${Date.now()}`);

    if (quizId === undefined) {
      console.error('[API] Failed to save generated exercise to cache.');
      return {
        quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
        quizId: -1,
        error: 'Failed to save exercise to cache.',
      };
    }

    const partialData: PartialQuizData = {
      paragraph: validatedAiData.paragraph,
      question: validatedAiData.question,
      options: validatedAiData.options,
      topic: validatedAiData.topic,
    };

    const payload: GenerateExerciseResult = {
      quizData: partialData,
      quizId: quizId,
      cached: !!cachedExercise,
    };

    console.log(`[API Perf] Total generateExerciseResponse time: ${Date.now() - start}ms`);
    return payload;
  } catch (error: unknown) {
    console.error('[API] AI Response Processing Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'AI model response parsing failed';

    return {
      quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
      quizId: -1,
      error: errorMessage,
    };
  }
};
