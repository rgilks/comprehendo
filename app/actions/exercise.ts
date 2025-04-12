'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { getActiveModel, getGoogleAIClient, getOpenAIClient, ModelConfig } from '@/lib/modelConfig';
import { LANGUAGES, type Language } from '@/contexts/LanguageContext';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

interface RateLimitRow {
  requests: string;
  updated_at: string;
  id: number;
}

// interface UserRecord {
//   id: number;
// }

interface GeneratedContentRow {
  id: number;
  language: string;
  level: string;
  content: string;
  questions: string;
  created_at: string;
}

const _exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof _exerciseRequestBodySchema>;

const fullQuizDataSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  explanations: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctAnswer: z.string(),
  relevantText: z.string(),
  topic: z.string(),
});

// Partial data sent to the client initially
// Export this type so it can be used in userProgress.ts
export type PartialQuizData = Pick<
  z.infer<typeof fullQuizDataSchema>,
  'paragraph' | 'question' | 'options' | 'topic'
>;

// Response type for generateExerciseResponse
interface GenerateExerciseResponsePayload {
  result: string; // JSON string of PartialQuizData
  quizId: number;
  error?: string;
  cached?: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

// Define a custom error for AI response processing issues
class AIResponseProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

/**
 * Check if the user has exceeded rate limits
 */
export const checkRateLimit = async (ip: string): Promise<boolean> => {
  try {
    // Initialize DB table if not exists
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
    return false;
  }
};

/**
 * Get cached exercise content if available
 */
export const getCachedExercise = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  seedValue: number
): Promise<GeneratedContentRow | undefined> => {
  // Proceed with database cache logic for logged-in users or other levels
  console.log('[API] Logged-in user or non-A1 level: Checking database cache.');
  try {
    // Function to get cached content with specific level
    const getCachedContent = (specificLevel: string) => {
      const result = db
        .prepare(
          `
        SELECT id, language, level, content, questions, created_at FROM generated_content \
        WHERE language = ? \
          AND question_language = ? \
          AND level = ? \
          AND seed_value = ?
        ORDER BY created_at DESC LIMIT 1
      `
        )
        .get(passageLanguage, questionLanguage, specificLevel, seedValue);

      // Validate result has the expected structure
      if (
        typeof result === 'object' &&
        result !== null &&
        'content' in result &&
        typeof result.content === 'string' &&
        'created_at' in result &&
        typeof result.created_at === 'string'
      ) {
        return result as GeneratedContentRow;
      }

      return undefined;
    };

    // First try with exact CEFR level
    const cachedContent = getCachedContent(level);

    return cachedContent;
  } catch (error) {
    console.error('[API] Error getting cached exercise:', error);
    return undefined;
  }
};

/**
 * Save generated exercise content to cache
 */
export const saveExerciseToCache = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  seedValue: number,
  jsonContent: string,
  userId: number | null
): Promise<number | undefined> => {
  console.log(
    `[API] Attempting to save exercise to cache. Params: lang=${passageLanguage}, qLang=${questionLanguage}, level=${level}, seed=${seedValue}, userId=${userId}`
  );
  try {
    // Use RETURNING id to get the inserted row's ID
    const result = db
      .prepare(
        `
        INSERT INTO generated_content (language, question_language, level, content, questions, created_at, seed_value, user_id) 
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        RETURNING id
      `
      )
      .get(
        passageLanguage,
        questionLanguage,
        level,
        jsonContent,
        jsonContent,
        seedValue,
        userId
      ) as { id: number } | undefined;

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
    return undefined;
  }
};

/**
 * Call the OpenAI API to generate exercise content
 */
async function callOpenAI(prompt: string, modelConfig: ModelConfig): Promise<string> {
  console.log('[API] Calling OpenAI API...');
  const openai = getOpenAIClient();

  try {
    const completion = await openai.chat.completions.create({
      model: modelConfig.name,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: modelConfig.maxTokens,
    });

    const result = completion.choices[0]?.message?.content;
    if (!result) {
      throw new AIResponseProcessingError('No content received from OpenAI');
    }
    console.log('[API] Received response from OpenAI.');
    return result;
  } catch (error: unknown) {
    console.error('[API] OpenAI API error:', error);
    let responseData: unknown;
    let rawResponse: unknown;

    if (error instanceof Error && 'response' in error) {
      const errorWithResponse = error as { response?: unknown }; // Type assertion after check
      rawResponse = errorWithResponse.response;
      if (rawResponse && typeof rawResponse === 'object' && 'data' in rawResponse) {
        responseData = (rawResponse as { data?: unknown }).data;
      }
    }

    if (responseData !== undefined) {
      console.error('[API] OpenAI Error Response Data:', responseData);
    } else if (rawResponse !== undefined) {
      console.error('[API] OpenAI Error Response (raw):', rawResponse);
    }

    // Safely get error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Assign error safely
    const processedError = new Error(`Failed to generate content using OpenAI: ${errorMessage}`);
    console.error('[API] OpenAI API error:', processedError);
    throw processedError;
  }
}

/**
 * Call the Google AI API to generate exercise content
 */
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
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new AIResponseProcessingError('No content received from Google AI');
    }
    console.log('[API] Received response from Google AI.');
    return text;
  } catch (error: unknown) {
    // Safely get error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Assign error safely
    const processedError = new Error(`Failed to generate content using Google AI: ${errorMessage}`);
    console.error('[API] Google AI API error:', processedError);
    throw processedError;
  }
}

/**
 * Main server action to generate exercise response
 */
export const generateExerciseResponse = async (
  params: ExerciseRequestParams
): Promise<GenerateExerciseResponsePayload> => {
  const { passageLanguage, questionLanguage, cefrLevel: level } = params;
  const headerList = await headers(); // Await the headers
  const ip = headerList.get('x-forwarded-for') || 'unknown';
  const session = await getServerSession();
  const userId = session?.user?.dbId || null;

  // Ensure all prompt variables are strings
  const topic: string = getRandomTopicForLevel(level as CEFRLevel);
  const grammarGuidance: string = getGrammarGuidance(level as CEFRLevel);
  const vocabularyGuidance: string = getVocabularyGuidance(level as CEFRLevel);
  const passageLangName: string = LANGUAGES[passageLanguage as Language]?.name || passageLanguage;
  const questionLangName: string =
    LANGUAGES[questionLanguage as Language]?.name || questionLanguage;

  console.log(
    `[API] Received request: lang=${passageLanguage}, qLang=${questionLanguage}, level=${level}, ip=${ip}, userId=${userId}`
  );

  // Rate Limiting
  console.log(`[API Perf] Rate Limit Check Start: ${Date.now()}`);
  if (!(await checkRateLimit(ip))) {
    console.warn(`[API] Rate limit exceeded for IP: ${ip}`);
    return { result: '', quizId: -1, error: 'Rate limit exceeded' };
  }
  console.log(`[API Perf] Rate Limit Check End: ${Date.now()}`);

  // --- Cache Check ---
  const seedValue = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Daily seed
  console.log(`[API Perf] Cache Check Start: ${Date.now()}`);
  const cachedExercise = await getCachedExercise(
    passageLanguage,
    questionLanguage,
    level,
    seedValue
  );
  console.log(`[API Perf] Cache Check End: ${Date.now()}`);

  if (cachedExercise) {
    console.log(
      `[API] Cache hit for lang=${passageLanguage}, level=${level}, seed=${seedValue}. Cache ID: ${cachedExercise.id}`
    );
    try {
      // Validate cached content immediately
      console.log(`[API Perf] Cache Validation Start: ${Date.now()}`);
      const parsedCachedContent = JSON.parse(cachedExercise.content);
      const validatedCachedData = fullQuizDataSchema.safeParse(parsedCachedContent);

      if (!validatedCachedData.success) {
        console.error('[API] Invalid data found in cache:', validatedCachedData.error.format());
        // Decide how to handle invalid cache data - perhaps proceed to generate new content?
        // For now, return error similar to generation failure.
        return { result: '', quizId: -1, error: 'Invalid cached data encountered.' };
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
        result: JSON.stringify(partialData),
        quizId: cachedExercise.id, // Use the ID from the cache record
        cached: true,
      };
    } catch (error) {
      console.error('[API] Error processing cached exercise:', error);
      // Fall through to generate new content if cache processing fails
    }
  } else {
    console.log(`[API] Cache miss for lang=${passageLanguage}, level=${level}, seed=${seedValue}`);
  }

  // --- Generation ---
  let aiResponseContent: string | undefined;
  let usageData: { promptTokens: number; completionTokens: number } | undefined;
  let validatedAiData: z.infer<typeof fullQuizDataSchema> | undefined; // Variable to hold validated data

  try {
    const activeModel = getActiveModel();
    console.log(`[API] Using AI model: ${activeModel.displayName}`);

    // topic, grammarGuidance, vocabularyGuidance already ensured to be strings

    const prompt = `
      Generate a reading comprehension exercise based on the following parameters:
      - Topic: ${topic}
      - Passage Language: ${passageLangName} (${passageLanguage})
      - Question Language: ${questionLangName} (${questionLanguage})
      - CEFR Level: ${level}
      - Grammar Guidance: ${grammarGuidance}
      - Vocabulary Guidance: ${vocabularyGuidance}

      Instructions:
      1. Create a short paragraph (3-6 sentences) in ${passageLanguage} suitable for a ${level} learner, focusing on the topic "${topic}".
      2. Write one multiple-choice question in ${questionLanguage} about the main idea or a specific detail of the paragraph.
      3. Provide four answer options (A, B, C, D) in ${questionLanguage}. Only one option should be correct. The options should be plausible but clearly distinguishable based on the paragraph.
      4. Identify the correct answer (A, B, C, or D).
      5. Provide a brief explanation (in ${questionLanguage}) for why each option is correct or incorrect.
      6. Extract the specific sentence or phrase from the original paragraph (in ${passageLanguage}) that provides the evidence for the correct answer ("relevantText").

      Output Format: Respond ONLY with a valid JSON object containing the following keys:
      - "paragraph": (string) The generated paragraph in ${passageLanguage}.
      - "topic": (string) The topic used: "${topic}".
      - "question": (string) The multiple-choice question in ${questionLanguage}.
      - "options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in ${questionLanguage}.
      - "correctAnswer": (string) The key ("A", "B", "C", or "D") of the correct answer.
      - "explanations": (object) An object with keys "A", "B", "C", "D", where each value is the explanation string in ${questionLanguage} for that option.
      - "relevantText": (string) The sentence or phrase from the paragraph in ${passageLanguage} that supports the correct answer.

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
      // TODO: Extract usage data if OpenAI provides it
    } else if (activeModel.provider === 'google') {
      aiResponseContent = await callGoogleAI(prompt, activeModel);
      // TODO: Extract usage data if Google AI provides it
    } else {
      throw new Error(`Unsupported model provider: ${activeModel.provider}`);
    }
    console.log(`[API Perf] AI Call End: ${Date.now()}`);

    if (!aiResponseContent) {
      throw new AIResponseProcessingError('Received empty response from AI model.');
    }

    // --- Immediate Validation of AI Response ---
    console.log(`[API Perf] AI Response Validation Start: ${Date.now()}`);
    let parsedAiContent: unknown; // Use unknown instead of any
    try {
      parsedAiContent = JSON.parse(aiResponseContent);
    } catch (parseError: unknown) {
      console.error('[API] Failed to parse AI response JSON:', aiResponseContent);
      // Ensure parseError is treated as Error or string for message
      const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
      throw new AIResponseProcessingError(
        `Failed to parse AI JSON response. Error: ${errorMessage}`
      );
    }

    // safeParse handles unknown input type
    const validationResult = fullQuizDataSchema.safeParse(parsedAiContent);

    if (!validationResult.success) {
      console.error(
        '[API] AI response failed Zod validation:',
        JSON.stringify(validationResult.error.format(), null, 2)
      );
      console.error('[API] Failing AI Response Content:', aiResponseContent); // Log the raw failing response
      throw new AIResponseProcessingError(
        `AI response failed validation. Errors: ${JSON.stringify(validationResult.error.format())}`
      );
    }
    validatedAiData = validationResult.data; // Store validated data
    console.log(`[API Perf] AI Response Validation End: ${Date.now()}`);
    // --- End Immediate Validation ---

    console.log(`[API Perf] Cache Save Start: ${Date.now()}`);
    // Save the original, validated JSON string to cache
    // Ensure userId is passed correctly (type number | null)
    const currentUserId = userId; // Assign to a new const to help type inference if needed
    const quizId = await saveExerciseToCache(
      passageLanguage,
      questionLanguage,
      level,
      seedValue,
      aiResponseContent, // Save the original string
      currentUserId
    );
    console.log(`[API Perf] Cache Save End: ${Date.now()}`);

    if (quizId === undefined) {
      console.error('[API] Failed to save generated exercise to cache.');
      // Decide if this is a critical error - maybe proceed without caching?
      // For now, let's return an error indication.
      return { result: '', quizId: -1, error: 'Failed to save exercise to cache.' };
    }

    // Prepare partial data using the validated data
    const partialData: PartialQuizData = {
      paragraph: validatedAiData.paragraph,
      question: validatedAiData.question,
      options: validatedAiData.options,
      topic: validatedAiData.topic,
    };

    return {
      result: JSON.stringify(partialData),
      quizId: quizId,
      usage: usageData,
    };
  } catch (error: unknown) {
    // Safely assign and log error
    let finalError: Error;
    if (error instanceof AIResponseProcessingError) {
      console.error('[API] AI Processing Error:', error.message);
      finalError = error;
    } else if (error instanceof Error) {
      console.error('[API] Error generating exercise:', error);
      finalError = error;
    } else {
      const unknownErrorMessage = 'An unknown error occurred during exercise generation.';
      console.error(`[API] ${unknownErrorMessage}:`, error);
      finalError = new Error(unknownErrorMessage);
    }

    return {
      result: '',
      quizId: -1,
      error: finalError.message, // Use the message from the guaranteed Error object
    };
  }
};
