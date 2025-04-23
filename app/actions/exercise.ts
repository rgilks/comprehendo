'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { getActiveModel, getGoogleAIClient, openai, ModelConfig } from '@/lib/modelConfig';
import { LANGUAGES, type Language } from '@/config/languages';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';
import { QuizDataSchema, GenerateExerciseResult, type PartialQuizData } from '@/lib/domain/schemas';
import * as Sentry from '@sentry/nextjs';
import { authOptions } from '@/lib/authOptions';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

interface RateLimitRow {
  request_count: number;
  window_start_time: string; // ISO 8601 string from SQLite TIMESTAMP
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
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    console.log(`[API] Checking rate limit for IP: ${ip}`);
    console.log(`[API Perf] Rate Limit - SELECT Start: ${Date.now()}`);

    const rateLimitRow = db
      .prepare('SELECT request_count, window_start_time FROM rate_limits WHERE ip_address = ?')
      .get(ip) as RateLimitRow | undefined;

    console.log(`[API Perf] Rate Limit - SELECT End: ${Date.now()}`);

    if (rateLimitRow) {
      const windowStartTime = new Date(rateLimitRow.window_start_time).getTime();
      const isWithinWindow = now - windowStartTime < RATE_LIMIT_WINDOW;

      if (isWithinWindow) {
        if (rateLimitRow.request_count >= MAX_REQUESTS_PER_HOUR) {
          console.log(
            `[API] Rate limit exceeded for IP: ${ip}. Count: ${rateLimitRow.request_count}, Window Start: ${rateLimitRow.window_start_time}`
          );
          Sentry.captureMessage(`Rate limit exceeded for IP: ${ip}`, {
            level: 'warning',
            extra: {
              ip_address: ip,
              request_count: rateLimitRow.request_count,
              window_start_time: rateLimitRow.window_start_time,
              max_requests: MAX_REQUESTS_PER_HOUR,
              rate_limit_window_ms: RATE_LIMIT_WINDOW,
            },
          });
          return false;
        } else {
          console.log(`[API Perf] Rate Limit - UPDATE Start: ${Date.now()}`);
          db.prepare(
            'UPDATE rate_limits SET request_count = request_count + 1 WHERE ip_address = ?'
          ).run(ip);
          console.log(`[API Perf] Rate Limit - UPDATE End: ${Date.now()}`);
          console.log(
            `[API] Rate limit incremented for IP: ${ip}. New Count: ${
              rateLimitRow.request_count + 1
            }`
          );
          return true;
        }
      } else {
        console.log(`[API] Rate limit window expired for IP: ${ip}. Resetting.`);
        console.log(`[API Perf] Rate Limit - RESET Start: ${Date.now()}`);
        db.prepare(
          'UPDATE rate_limits SET request_count = 1, window_start_time = ? WHERE ip_address = ?'
        ).run(nowISO, ip);
        console.log(`[API Perf] Rate Limit - RESET End: ${Date.now()}`);
        return true;
      }
    } else {
      console.log(`[API] No rate limit record found for IP: ${ip}. Creating new record.`);
      console.log(`[API Perf] Rate Limit - INSERT Start: ${Date.now()}`);
      db.prepare(
        'INSERT INTO rate_limits (ip_address, request_count, window_start_time) VALUES (?, 1, ?)'
      ).run(ip, nowISO);
      console.log(`[API Perf] Rate Limit - INSERT End: ${Date.now()}`);
      return true;
    }
  } catch (error) {
    console.error('[API] Error checking rate limit:', error);
    Sentry.captureException(error);
    return false;
  }
};

export const getCachedExercise = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  userId: number | null
): Promise<QuizRow | undefined> => {
  if (!db) throw new Error('Database not initialized');

  try {
    let stmt;
    let result;

    if (userId !== null) {
      const sql = `SELECT 
           q.id, q.language, q.level, q.content, q.created_at, q.question_language
         FROM 
           quiz q
         LEFT JOIN 
           question_feedback qf ON q.id = qf.quiz_id AND qf.user_id = ?
         WHERE 
           q.language = ? 
           AND q.question_language = ? 
           AND q.level = ?
           AND qf.user_id IS NULL -- Ensure no feedback exists for this user
         ORDER BY 
           q.created_at DESC 
         LIMIT 1`;
      stmt = db.prepare<[number, string, string, string]>(sql);
      result = stmt.get(userId, passageLanguage, questionLanguage, level) as QuizRow | undefined;
    } else {
      const sql = `SELECT id, language, level, content, created_at, question_language
         FROM quiz
         WHERE language = ? AND question_language = ? AND level = ?
         ORDER BY created_at DESC LIMIT 1`;
      stmt = db.prepare<[string, string, string]>(sql);
      result = stmt.get(passageLanguage, questionLanguage, level) as QuizRow | undefined;
    }

    return result;
  } catch (error) {
    console.error('[API] Error getting cached exercise:', error);
    Sentry.captureException(error, { extra: { userId, passageLanguage, questionLanguage, level } });
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

  try {
    const result = db
      .prepare(
        `
        INSERT INTO quiz (language, question_language, level, content, created_at, user_id)
        VALUES (?, ?, ?, ?, datetime('now'), ?) -- Use datetime('now') explicitly and 6 placeholders
        RETURNING id
      `
      )
      .get(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        userId // Pass userId as the 5th argument corresponding to the 6th placeholder
      ) as { id: number } | undefined;

    if (result?.id) {
      return result.id;
    } else {
      console.error(
        '[API] Failed to get ID after saving to cache. The insert might have failed silently or RETURNING id did not work as expected.'
      );
      return undefined;
    }
  } catch (error) {
    console.error('[API] Error saving to cache during DB operation:', error);
    Sentry.captureException(error, { extra: { userId, passageLanguage, questionLanguage, level } });
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
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for') || 'unknown';
  const session = await getServerSession(authOptions);

  const { passageLanguage, questionLanguage, cefrLevel: level } = params;

  const passageLanguageStr = String(passageLanguage);
  const questionLanguageStr = String(questionLanguage);
  const levelStr = String(level);

  // --- Parameter Validation ---
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

  // --- Rate Limit Check ---
  const isRateLimited = !(await checkRateLimit(ip));
  if (isRateLimited) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}`);
    // If rate limited, immediately try to fall back to cache
  }

  // --- Cache Count Check ---
  const CACHE_GENERATION_THRESHOLD = 100;
  const cachedCount = await countCachedExercises(passageLanguage, questionLanguage, level);
  const shouldPreferCache = isRateLimited || cachedCount >= CACHE_GENERATION_THRESHOLD;

  // --- Primary Path: Generate New Exercise ---
  if (!shouldPreferCache) {
    try {
      const topicResult = getRandomTopicForLevel(cefrLevelTyped);
      const topic = typeof topicResult === 'string' ? topicResult : String(topicResult);
      const grammarGuidance: string = getGrammarGuidance(cefrLevelTyped);
      const vocabularyGuidance: string = getVocabularyGuidance(cefrLevelTyped);
      const passageLangName: string =
        LANGUAGES[passageLanguageStr as Language] ?? passageLanguageStr;
      const questionLangName: string =
        LANGUAGES[questionLanguageStr as Language] ?? questionLanguageStr;

      const activeModel = getActiveModel();

      const prompt = `Generate a reading comprehension exercise based on the following parameters:\n- Topic: ${String(topic)}\n- Passage Language: ${passageLangName} (${passageLanguageStr})\n- Question Language: ${questionLangName} (${questionLanguageStr})\n- CEFR Level: ${levelStr}\n- Grammar Guidance: ${grammarGuidance}\n- Vocabulary Guidance: ${vocabularyGuidance}\n\nInstructions:\n1. Create a short paragraph (3-6 sentences) in ${passageLanguageStr} suitable for a ${levelStr} learner, focusing on the topic \"${String(topic)}\".\n2. Write ONE multiple-choice question in ${questionLanguageStr}. The question should target ONE of the following comprehension skills based on the paragraph: (a) main idea, (b) specific detail, (c) inference (requiring understanding information implied but not explicitly stated), OR (d) vocabulary in context (asking the meaning of a word/phrase as used in the paragraph).\n3. Provide four answer options (A, B, C, D) in ${questionLanguageStr}. Only one option should be correct.\n4. Create plausible distractors (incorrect options B, C, D): These should relate to the topic but be clearly contradicted, unsupported by the paragraph, or represent common misinterpretations based *only* on the text. Avoid options that are completely unrelated or rely on outside knowledge. **Ensure distractors are incorrect specifically because they contradict or are unsupported by the provided paragraph.**\n5. **CRITICAL REQUIREMENT:** The question **must be impossible** to answer correctly *without* reading and understanding the provided paragraph. The answer **must depend solely** on the specific details or implications within the text. Avoid any questions solvable by general knowledge or common sense.\n6. Identify the correct answer key (A, B, C, or D).\n7. Provide a brief explanation (in ${questionLanguageStr}) for why the correct answer is right and each incorrect option is wrong. CRITICALLY, each explanation MUST explicitly reference the specific part of the paragraph that supports the correct answer or contradicts the incorrect option.\n8. Extract the specific sentence or phrase from the original paragraph (in ${passageLanguageStr}) that provides the primary evidence for the correct answer (\"relevantText\").\n\nOutput Format: Respond ONLY with a valid JSON object containing the following keys:\n- \"paragraph\": (string) The generated paragraph in ${passageLanguageStr}.\n- \"topic\": (string) The topic used: \"${String(topic)}\".\n- \"question\": (string) The multiple-choice question in ${questionLanguageStr}.\n- \"options\": (object) An object with keys \"A\", \"B\", \"C\", \"D\", where each value is an answer option string in ${questionLanguageStr}.\n- \"correctAnswer\": (string) The key (\"A\", \"B\", \"C\", or \"D\") of the correct answer.\n- \"explanations\": (object) An object with keys \"A\", \"B\", \"C\", \"D\", where each value is the explanation string in ${questionLanguageStr} for that option, explicitly referencing the text.\n- \"relevantText\": (string) The sentence or phrase from the paragraph in ${passageLanguageStr} that supports the correct answer.\n\nExample JSON structure:\n{\n  \"paragraph\": \"...\",\n  \"topic\": \"...\",\n  \"question\": \"...\",\n  \"options\": { \"A\": \"...\", \"B\": \"...\", \"C\": \"...\", \"D\": \"...\" },\n  \"correctAnswer\": \"B\",\n  \"explanations\": { \"A\": \"Explanation referencing text...\", \"B\": \"Explanation referencing text...\", \"C\": \"Explanation referencing text...\", \"D\": \"Explanation referencing text...\" },\n  \"relevantText\": \"...\"\n}\n\nEnsure the entire output is a single, valid JSON object string without any surrounding text or markdown formatting.\n`;

      let aiResponseContent: string | undefined;
      if (activeModel.provider === 'openai') {
        aiResponseContent = await callOpenAI(prompt, activeModel);
      } else if (activeModel.provider === 'google') {
        aiResponseContent = await callGoogleAI(prompt, activeModel);
      } else {
        throw new Error(`Unsupported model provider: ${activeModel.provider}`);
      }

      // Log the raw AI response content
      console.log('[API] Raw AI response content:', aiResponseContent);

      if (!aiResponseContent) {
        throw new AIResponseProcessingError('Received empty response from AI model.');
      }

      let parsedAiContent: unknown;
      try {
        parsedAiContent = JSON.parse(aiResponseContent);
      } catch (parseError: unknown) {
        console.error(
          '[API] Failed to parse AI response JSON:',
          parseError,
          '\\nRaw Response:\\n',
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
          `AI response failed validation. Errors: ${JSON.stringify(
            validationResult.error.format()
          )}`
        );
      }
      const validatedAiData = validationResult.data;

      // --- Direct User ID Lookup before saving ---
      let finalUserId: number | null = null;
      if (session?.user?.id && session?.user?.provider) {
        try {
          const userRecord = db
            .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
            .get(session.user.id, session.user.provider);
          if (
            userRecord &&
            typeof userRecord === 'object' &&
            'id' in userRecord &&
            typeof userRecord.id === 'number'
          ) {
            finalUserId = userRecord.id;
          } else {
            console.warn(
              `[API] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
            );
          }
        } catch (dbError) {
          console.error('[API] Direct lookup DB error:', dbError);
          // Proceed with finalUserId as null
        }
      } else {
        console.warn(
          `[API] Cannot perform direct lookup: Missing session.user.id (${session?.user?.id}) or session.user.provider (${session?.user?.provider})`
        );
      }
      // --- End Direct User ID Lookup ---

      const quizId = await saveExerciseToCache(
        passageLanguage,
        questionLanguage,
        level,
        aiResponseContent, // Save the raw valid JSON
        finalUserId // Use the directly looked-up ID
      );

      if (quizId === undefined) {
        console.error('[API] Failed to save generated exercise to cache.');
        // Proceed without cache ID, but log error
        const partialData: PartialQuizData = {
          paragraph: validatedAiData.paragraph,
          question: validatedAiData.question,
          options: validatedAiData.options,
          topic: validatedAiData.topic,
        };
        return {
          quizData: partialData,
          quizId: -1, // Indicate error or non-cache state
          error: 'Failed to save exercise to cache.',
          cached: false,
        };
      }

      const partialData: PartialQuizData = {
        paragraph: validatedAiData.paragraph,
        question: validatedAiData.question,
        options: validatedAiData.options,
        topic: validatedAiData.topic,
      };

      return {
        quizData: partialData,
        quizId: quizId,
        cached: false, // Mark as newly generated
      };
    } catch (error: unknown) {
      console.error('[API] Error during AI Generation Path:', error);
      Sentry.captureException(error);
      // If AI generation fails, fall through to try the cache as a last resort
      console.warn('[API] AI Generation failed, falling back to cache check.');
    }
  }

  // --- Fallback Path: Use Cached Exercise ---
  const cachedExercise = await getCachedExercise(
    passageLanguage,
    questionLanguage,
    level,
    session?.user?.dbId || null
  );

  if (cachedExercise) {
    try {
      const parsedCachedContent = JSON.parse(cachedExercise.content);
      const validatedCachedData = QuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error('[API] Invalid data found in cache:', validatedCachedData.error.format());
        // Don't return error, try generating if possible or return empty
      } else {
        // Type is inferred correctly after successful validation
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
      }
    } catch (error) {
      console.error('[API] Error processing cached exercise:', error);
      // Fall through if cache processing fails
    }
  }

  // --- Final Fallback: No Question Available ---
  console.error(
    `[API] Exhausted options: Failed to generate and no suitable cache found for lang=${passageLanguage}, level=${level}, user=${session?.user?.dbId ?? 'anonymous'}.`
  );
  return {
    quizData: { paragraph: '', question: '', options: { A: '', B: '', C: '', D: '' } },
    quizId: -1,
    error: 'Could not retrieve or generate a question.',
  };
};

// Function to count existing cached exercises
export const countCachedExercises = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string
): Promise<number> => {
  if (!db) throw new Error('Database not initialized');
  try {
    const stmt = db.prepare<[string, string, string]>(
      `SELECT COUNT(*) as count
       FROM quiz
       WHERE language = ? AND question_language = ? AND level = ?`
    );
    const result = stmt.get(passageLanguage, questionLanguage, level) as
      | { count: number }
      | undefined;
    return result?.count ?? 0;
  } catch (error) {
    console.error('[API] Error counting cached exercises:', error);
    Sentry.captureException(error, { extra: { passageLanguage, questionLanguage, level } });
    return 0; // Return 0 on error to avoid blocking generation if counting fails
  }
};
