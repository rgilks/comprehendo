'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { getActiveModel, getGoogleAIClient, getOpenAIClient, ModelConfig } from '@/lib/modelConfig';
import { LANGUAGES, type Language } from '@/contexts/LanguageContext';
import { CEFRLevel, getGrammarGuidance, getVocabularyGuidance } from '@/config/language-guidance';
import { getRandomTopicForLevel } from '@/config/topics';

// Constants
const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

// Types
interface RateLimitRow {
  requests: string;
  updated_at: string;
}

interface UserRecord {
  id: number;
}

// Define the structure for a row from the generated_content table
interface GeneratedContentRow {
  id: number;
  language: string;
  level: string;
  content: string;
  questions: string; // Assuming questions holds similar data based on context, adjust if needed
  created_at: string;
}

// Zod Schema
const exerciseRequestBodySchema = z.object({
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  cefrLevel: z.string(),
});

export type ExerciseRequestParams = z.infer<typeof exerciseRequestBodySchema>;

// Full quiz data schema (used for validation and DB storage)
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
type PartialQuizData = Pick<
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
    await Promise.resolve(
      db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_address TEXT PRIMARY KEY,
        requests TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)
    );

    const now = Date.now();
    let userRequests: number[] = [];

    console.log(`[API] Checking rate limit for IP: ${ip}`);
    const rateLimitRow = db
      .prepare('SELECT requests, updated_at FROM rate_limits WHERE ip_address = ?')
      .get(ip) as RateLimitRow | undefined;

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

      db.prepare('UPDATE rate_limits SET updated_at = CURRENT_TIMESTAMP WHERE ip_address = ?').run(
        ip
      );
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

    db.prepare(
      `
      INSERT INTO rate_limits (ip_address, requests, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip_address) DO UPDATE SET
      requests = ?, updated_at = CURRENT_TIMESTAMP
    `
    ).run(ip, JSON.stringify(updatedRequests), JSON.stringify(updatedRequests));

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
          AND id % 100 = ?\
        ORDER BY created_at DESC LIMIT 1
      `
        )
        .get(passageLanguage, questionLanguage, specificLevel, seedValue % 100);

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

    const errorMessage = error instanceof Error ? error.message : 'Unknown OpenAI error';
    throw new Error(`Failed to generate content using OpenAI: ${errorMessage}`);
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
    console.error('[API] Google AI API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown Google AI error';
    throw new Error(`Failed to generate content using Google AI: ${errorMessage}`);
  }
}

/**
 * Main server action to generate exercise response
 */
export const generateExerciseResponse = async (
  params: ExerciseRequestParams
): Promise<GenerateExerciseResponsePayload> => {
  const session = await getServerSession();
  let userId: number | null = null;
  let isLoggedIn = false;

  // --- Get User ID from session --- START
  if (session?.user?.email) {
    try {
      const userRecord = db
        .prepare('SELECT id FROM users WHERE email = ?')
        .get(session.user.email) as UserRecord | undefined;
      if (userRecord) {
        userId = userRecord.id;
        isLoggedIn = true;
      } else {
        console.warn(`[API] User with email ${session.user.email} not found in users table.`);
        // Handle case where session exists but user record is missing
        // Potentially return an error or proceed as anonymous
      }
    } catch (dbError) {
      console.error('[API] Database error fetching user by email:', dbError);
      return { result: '', quizId: 0, error: 'Database error checking user.' };
    }
  }
  // --- Get User ID from session --- END

  // --- Get IP Address from headers --- START
  let ipAddress: string | null = null;
  try {
    const headerList = await headers();
    // Common headers for IP address behind proxies
    const forwardedFor = headerList.get('x-forwarded-for');
    const realIp = headerList.get('x-real-ip');

    if (forwardedFor) {
      ipAddress = forwardedFor.split(',')[0]?.trim() || null;
    } else if (realIp) {
      ipAddress = realIp.trim();
    }

    console.log(`[API] Determined IP Address from headers: ${ipAddress}`);
  } catch (error: unknown) {
    console.warn('[API] Could not read headers to determine IP:', error);
  }
  // --- Get IP Address from headers --- END

  console.log(`[API] generateExerciseResponse called with params:`, params);
  console.log(`[API] User ID: ${userId}, Logged In: ${isLoggedIn}, IP: ${ipAddress}`);

  // Validate input using Zod
  const validation = exerciseRequestBodySchema.safeParse(params);
  if (!validation.success) {
    console.error('[API] Invalid request params:', validation.error.errors);
    return {
      result: '',
      quizId: 0,
      error: validation.error.errors.map((e) => e.message).join(', '),
    };
  }

  // Destructure validated data
  const { passageLanguage, questionLanguage, cefrLevel } = validation.data;

  // Generate topic and seed internally
  const levelToUse = cefrLevel as CEFRLevel; // Ensure correct type
  const topic = getRandomTopicForLevel(levelToUse);
  const seed = Math.floor(Math.random() * 100);
  console.log(`[API] Internally generated topic: ${topic}, seed: ${seed}`);

  // Rate Limiting - Use determined ipAddress for anonymous users
  if (isLoggedIn && userId) {
    const rateLimitPassed = await checkRateLimit(String(userId));
    if (!rateLimitPassed) {
      return { result: '', quizId: 0, error: 'Rate limit exceeded' };
    }
  } else if (!isLoggedIn && ipAddress) {
    // Use determined ipAddress
    const rateLimitPassed = await checkRateLimit(ipAddress);
    if (!rateLimitPassed) {
      return { result: '', quizId: 0, error: 'Rate limit exceeded' };
    }
  } else if (!isLoggedIn && !ipAddress) {
    console.warn('[API] Cannot apply rate limit: User not logged in and IP address not available.');
  }

  // Check cache first
  try {
    const cachedRow = await getCachedExercise(passageLanguage, questionLanguage, cefrLevel, seed);

    if (cachedRow) {
      console.log(
        `[API] Cache hit (ID: ${cachedRow.id}) for lang=${passageLanguage} level=${cefrLevel} seed=${seed % 100}`
      );
      try {
        // Parse the full content from cache
        const fullData: unknown = JSON.parse(cachedRow.content);
        // Validate against the full schema BEFORE accessing properties
        const validatedFullData = fullQuizDataSchema.parse(fullData);

        // Create partial data using validated data
        const partialData: PartialQuizData = {
          paragraph: validatedFullData.paragraph,
          question: validatedFullData.question,
          options: validatedFullData.options,
          topic: validatedFullData.topic,
        };
        return {
          result: JSON.stringify(partialData),
          quizId: cachedRow.id,
          cached: true,
        };
      } catch (jsonError: unknown) {
        console.error('[API] Invalid JSON found in cache, proceeding to generate:', jsonError);
        // Optionally delete the invalid cache entry here?
      }
    }
  } catch (cacheError: unknown) {
    console.error('[API] Error checking cache:', cacheError);
  }

  console.log('[API] Cache miss or invalid. Generating new content...');

  // Construct the prompt internally
  const passageLanguageName = LANGUAGES[passageLanguage as Language] || passageLanguage;
  const questionLanguageName = LANGUAGES[questionLanguage as Language] || questionLanguage;

  let languageInstructions = '';
  if (['A1', 'A2'].includes(levelToUse)) {
    const vocabGuidance = getVocabularyGuidance(levelToUse);
    const grammarGuidance = getGrammarGuidance(levelToUse);
    languageInstructions = `\n\nVocabulary guidance: ${vocabGuidance}\n\nGrammar guidance: ${grammarGuidance}`;
  }

  const constructedPrompt = `Generate a reading passage in ${passageLanguageName} suitable for CEFR level ${levelToUse} about the topic "${topic}". The passage should be interesting and typical for language learners at this stage. 

After the passage, provide a multiple-choice comprehension question about it, four answer options (A, B, C, D), indicate the correct answer letter, provide a brief topic description (3-5 words in English) for image generation, provide explanations for each option being correct or incorrect, and include the relevant text snippet from the passage supporting the correct answer. 

FORMAT THE QUESTION, OPTIONS, AND EXPLANATIONS IN ${questionLanguageName}. This is extremely important - the question and all answer options must be in ${questionLanguageName}, not in ${passageLanguageName}. 

**CRITICAL INSTRUCTION: Respond ONLY with a single, valid JSON object.** Do not include any text, markdown formatting, or explanations outside of the JSON structure. The JSON object MUST contain these exact keys, with string values:
- "paragraph": The reading passage text.
- "question": The comprehension question text.
- "options": An object with keys "A", "B", "C", "D" mapping to the answer choice strings.
- "explanations": An object with keys "A", "B", "C", "D" mapping to the explanation strings for each option.
- "correctAnswer": A single string containing the correct answer letter ("A", "B", "C", or "D").
- "relevantText": The specific text snippet from the paragraph that supports the correct answer.
- "topic": A brief English topic description (3-5 words).

Ensure all string values within the JSON are properly escaped.${languageInstructions}`;

  console.log('[API] Constructed prompt:', constructedPrompt.substring(0, 250) + '...');

  // Get active AI model configuration
  const modelConfig = getActiveModel();
  console.log(`[API] Using AI model: ${modelConfig.provider} - ${modelConfig.name}`);

  // Call the appropriate AI API
  let generatedJson: string;
  try {
    if (modelConfig.provider === 'openai') {
      generatedJson = await callOpenAI(constructedPrompt, modelConfig);
    } else if (modelConfig.provider === 'google') {
      generatedJson = await callGoogleAI(constructedPrompt, modelConfig);
    } else {
      throw new Error('Invalid AI provider specified in configuration');
    }

    // Validate the AI's JSON response against the schema
    let fullDataValidated: z.infer<typeof fullQuizDataSchema>;
    try {
      const parsedJson: unknown = JSON.parse(generatedJson);
      fullDataValidated = fullQuizDataSchema.parse(parsedJson); // Validate full structure
      console.log('[API] AI response FULL JSON structure validated successfully.');
    } catch (validationError: unknown) {
      console.error('[API] AI response validation failed:', validationError);
      console.error('[API] Problematic JSON:', generatedJson);

      if (validationError instanceof z.ZodError) {
        throw new AIResponseProcessingError(
          `AI response failed validation: ${validationError.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ')}`
        );
      } else {
        const message =
          validationError instanceof Error ? validationError.message : 'Unknown validation error';
        if (validationError instanceof SyntaxError) {
          throw new AIResponseProcessingError(`AI response is not valid JSON: ${message}`);
        } else {
          throw new AIResponseProcessingError(`AI response validation failed: ${message}`);
        }
      }
    }

    // Save the valid response to cache - use internally generated seed
    const savedQuizId = await saveExerciseToCache(
      passageLanguage,
      questionLanguage,
      cefrLevel,
      seed,
      generatedJson, // Save the original full JSON string
      userId
    );

    if (!savedQuizId) {
      // Handle failure to save/get ID
      return { result: '', quizId: 0, error: 'Failed to save exercise to cache.' };
    }

    // Prepare partial data for the client
    const partialData: PartialQuizData = {
      paragraph: fullDataValidated.paragraph,
      question: fullDataValidated.question,
      options: fullDataValidated.options,
      topic: fullDataValidated.topic,
    };

    // TODO: Implement actual token counting if needed
    const usage = { promptTokens: 0, completionTokens: 0 };

    // Return partial data and the new ID
    return { result: JSON.stringify(partialData), quizId: savedQuizId, usage };
  } catch (error: unknown) {
    console.error('[API] Error during AI call or processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate exercise';
    return { result: '', quizId: 0, error: errorMessage }; // Ensure return type matches
  }
};
