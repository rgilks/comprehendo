'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { getActiveModel, getGoogleAIClient, getOpenAIClient, ModelConfig } from '@/lib/modelConfig';

// Constants
const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

// Types
interface RateLimitRow {
  requests: string;
  updated_at: string;
}

interface GeneratedContentRow {
  id: number;
  language: string;
  level: string;
  content: string;
  questions: string;
  created_at: string;
}

interface UserRecord {
  id: number;
}

// Zod Schema
const exerciseRequestBodySchema = z.object({
  prompt: z.string().min(1, { message: 'Prompt is required' }),
  seed: z.number().optional(),
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  forceCache: z.boolean().optional(),
  languageRequirement: z.string().optional(),
});

export type ExerciseRequestParams = z.infer<typeof exerciseRequestBodySchema>;

// Quiz data schema to validate responses
const quizDataSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  explanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correctAnswer: z.string(),
  relevantText: z.string(),
  topic: z.string(),
});

// Define a custom error for AI response processing issues
class AIResponseProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

// Define 3 static A1 exercises for unlogged-in users
const staticA1Exercises: GeneratedContentRow[] = [
  {
    id: 1001, // Use distinct IDs > 1000 to avoid potential conflicts with real IDs % 100
    language: 'en',
    level: 'A1',
    content: JSON.stringify({
      paragraph: 'This is a cat. The cat is black. It likes to sleep.',
      question: 'What color is the cat?',
      options: { A: 'White', B: 'Black', C: 'Orange', D: 'Gray' },
      explanations: {
        A: 'The text says the cat is black.',
        B: 'Correct! The text states "The cat is black."',
        C: 'The text does not mention orange.',
        D: 'The text does not mention gray.',
      },
      correctAnswer: 'B',
      relevantText: 'The cat is black.',
      topic: 'Simple Animal',
    }),
    questions:
      '{ "question": "What color is the cat?", "options": {"A":"White","B":"Black","C":"Orange","D":"Gray"}, "explanations": {"A":"The text says the cat is black.","B":"Correct! The text states \"The cat is black.\"","C":"The text does not mention orange.","D":"The text does not mention gray."}, "correctAnswer": "B", "relevantText": "The cat is black.", "topic": "Simple Animal" }', // Pre-stringify for simplicity
    created_at: new Date().toISOString(),
  },
  {
    id: 1002,
    language: 'en',
    level: 'A1',
    content: JSON.stringify({
      paragraph: 'I have a red ball. I play with my ball in the park.',
      question: 'Where do I play with the ball?',
      options: { A: 'At home', B: 'At school', C: 'In the park', D: 'In the car' },
      explanations: {
        A: 'The text says playing happens in the park.',
        B: 'School is not mentioned.',
        C: 'Correct! The text says "I play with my ball in the park."',
        D: 'Playing in the car is not mentioned.',
      },
      correctAnswer: 'C',
      relevantText: 'I play with my ball in the park.',
      topic: 'Simple Toys',
    }),
    questions:
      '{ "question": "Where do I play with the ball?", "options": {"A":"At home","B":"At school","C":"In the park","D":"In the car"}, "explanations": {"A":"The text says playing happens in the park.","B":"School is not mentioned.","C":"Correct! The text says \"I play with my ball in the park.\"","D":"Playing in the car is not mentioned."}, "correctAnswer": "C", "relevantText": "I play with my ball in the park.", "topic": "Simple Toys" }',
    created_at: new Date().toISOString(),
  },
  {
    id: 1003,
    language: 'en',
    level: 'A1',
    content: JSON.stringify({
      paragraph: 'My name is Tom. I see a big blue bird.',
      question: 'What do I see?',
      options: {
        A: 'A small red fish',
        B: 'A big blue bird',
        C: 'A green frog',
        D: 'A yellow dog',
      },
      explanations: {
        A: 'The text mentions a bird, not a fish.',
        B: 'Correct! The text says "I see a big blue bird."',
        C: 'A frog is not mentioned.',
        D: 'A dog is not mentioned.',
      },
      correctAnswer: 'B',
      relevantText: 'I see a big blue bird.',
      topic: 'Simple Observation',
    }),
    questions:
      '{ "question": "What do I see?", "options": {"A":"A small red fish","B":"A big blue bird","C":"A green frog","D":"A yellow dog"}, "explanations": {"A":"The text mentions a bird, not a fish.","B":"Correct! The text says \"I see a big blue bird.\"","C":"A frog is not mentioned.","D":"A dog is not mentioned."}, "correctAnswer": "B", "relevantText": "I see a big blue bird.", "topic": "Simple Observation" }',
    created_at: new Date().toISOString(),
  },
];

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
  seedValue: number,
  forceCache: boolean = false,
  isLoggedIn: boolean
): Promise<GeneratedContentRow | undefined> => {
  // Special case: A1 level for unlogged-in users
  if (level === 'A1' && !isLoggedIn) {
    console.log('[API] Unlogged-in A1 request: Returning static exercise.');
    // Cycle through the 3 static exercises based on time or seed
    const index = (seedValue || Date.now()) % staticA1Exercises.length;
    return staticA1Exercises[index];
  }

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
    let cachedContent = getCachedContent(level);

    // If forceCache is true and no content found, try with surrounding CEFR levels
    if (forceCache && !cachedContent) {
      console.log(`[API] Force cache enabled but no content for ${level}, trying nearby levels`);
      const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = cefrLevels.indexOf(level);

      // Try one level easier if available
      if (currentIndex > 0) {
        const easierLevel = cefrLevels[currentIndex - 1];
        console.log(`[API] Trying easier level: ${easierLevel}`);
        cachedContent = getCachedContent(easierLevel);
        if (cachedContent) {
          console.log(`[API] Found content at easier level: ${easierLevel}`);
        }
      }

      // If still not found, try one level harder if available
      if (!cachedContent && currentIndex < cefrLevels.length - 1) {
        const harderLevel = cefrLevels[currentIndex + 1];
        console.log(`[API] Trying harder level: ${harderLevel}`);
        cachedContent = getCachedContent(harderLevel);
        if (cachedContent) {
          console.log(`[API] Found content at harder level: ${harderLevel}`);
        }
      }

      // If still not found, try any level as last resort
      if (!cachedContent) {
        console.log(`[API] Force cache: last resort - trying any content for this language pair`);
        const anyLevelContent = db
          .prepare(
            `
          SELECT id, language, level, content, questions, created_at FROM generated_content \
          WHERE language = ? \
            AND question_language = ? \
          ORDER BY created_at DESC LIMIT 1
        `
          )
          .get(passageLanguage, questionLanguage);

        if (
          typeof anyLevelContent === 'object' &&
          anyLevelContent !== null &&
          'content' in anyLevelContent &&
          typeof anyLevelContent.content === 'string'
        ) {
          cachedContent = anyLevelContent as GeneratedContentRow;
          console.log(`[API] Found ANY level content for this language pair`);
        }
      }
    }

    return cachedContent;
  } catch (error) {
    console.error('[API] Error getting cached exercise:', error);
    return undefined;
  }
};

/**
 * Save the generated content to the database
 */
export const saveGeneratedContent = async (
  passageLanguage: string,
  questionLanguage: string,
  level: string,
  content: string
): Promise<number | undefined> => {
  try {
    // Extract questions from content to save separately
    let questions = '';
    try {
      // Define a type for the expected content structure
      interface QuizContent {
        paragraph?: string;
        question?: string;
        options?: Record<string, string>;
        explanations?: Record<string, string>;
        correctAnswer?: string;
        relevantText?: string;
        topic?: string;
      }

      // Try to parse the content as JSON to extract questions
      const contentStr = content.replace(/```json|```/g, '').trim();
      const contentObj = JSON.parse(contentStr) as QuizContent;

      if (contentObj.options || contentObj.question) {
        // Extract questions part
        questions = JSON.stringify({
          question: contentObj.question || '',
          options: contentObj.options || {},
          explanations: contentObj.explanations || {},
          correctAnswer: contentObj.correctAnswer || '',
          relevantText: contentObj.relevantText || '',
          topic: contentObj.topic || '',
        });
      }
    } catch (parseError) {
      console.warn('[API] Could not parse content as JSON for questions extraction:', parseError);
      // Default empty questions object that satisfies the schema
      questions = JSON.stringify({
        question: '',
        options: {},
        explanations: {},
        correctAnswer: '',
        relevantText: '',
        topic: '',
      });
    }

    const savedId = db
      .prepare(
        `
        INSERT INTO generated_content (
          language, 
          level, 
          content, 
          questions,
          created_at,
          question_language
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        RETURNING id
      `
      )
      .get(passageLanguage, level, content, questions, questionLanguage) as
      | { id: number }
      | undefined;

    if (savedId) {
      console.log(`[API] Saved generated content to database with ID: ${savedId.id}`);
      return savedId.id;
    } else {
      console.warn('[API] Failed to save generated content to database');
      return undefined;
    }
  } catch (error) {
    console.error('[API] Error saving content to database:', error);
    return undefined;
  }
};

/**
 * Log usage statistics
 */
export const logUsageStats = async (
  userId: number | null,
  ip: string,
  language: string,
  level: string
): Promise<void> => {
  if (userId) {
    try {
      db.prepare(
        `
        INSERT INTO usage_stats (
          user_id,
          ip_address, 
          language,
          level,
          timestamp
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
      ).run(userId, ip, language, level);

      console.log(`[API] Logged usage in stats for user ${userId}`);
    } catch (error) {
      console.error('[API] Error logging usage stats:', error);
    }
  }
};

/**
 * Generate content with OpenAI
 */
export const generateWithOpenAI = async (prompt: string, model: ModelConfig): Promise<string> => {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: model.name,
      messages: [
        {
          role: 'system',
          content:
            'You are a language learning assistant that creates reading comprehension exercises. Always format your response as valid JSON without markdown code blocks. The JSON must include: paragraph, question, options (A,B,C,D), explanations (A,B,C,D), correctAnswer, relevantText, and topic fields. IMPORTANT: Make sure the question, options, and explanations are in the question language specified in the prompt, NOT in the passage language.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    return await processAIResponse(completion.choices[0].message.content || '');
  } catch (error) {
    console.error('[API] OpenAI generation error:', error);
    throw new Error('Error generating content with OpenAI');
  }
};

/**
 * Generate content with Google AI
 */
export const generateWithGoogleAI = async (prompt: string, model: ModelConfig): Promise<string> => {
  try {
    const genAI = getGoogleAIClient();
    const generativeModel = genAI.getGenerativeModel({
      model: model.name,
    });

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${prompt} 
IMPORTANT: Respond with valid JSON only, no markdown formatting or code blocks.
The JSON must include these exact fields:
- paragraph: the text passage (in the passage language)
- question: the comprehension question (in the question language)
- options: an object with keys A, B, C, D containing answer choices (in the question language)
- explanations: an object with keys A, B, C, D explaining each answer (in the question language)
- correctAnswer: one of "A", "B", "C", or "D"
- relevantText: the part of paragraph that answers the question (in the passage language)
- topic: a brief description of the topic

CRITICAL INSTRUCTION: The question, options, and explanations MUST be in the question language mentioned in the prompt, NOT in the passage language. This is essential for user experience.`,
            },
          ],
        },
      ],
    });

    return await processAIResponse(result.response.text());
  } catch (error) {
    console.error('[API] Google AI generation error:', error);
    throw new Error('Error generating content with Google AI');
  }
};

/**
 * Helper function to process and validate AI responses
 */
export const processAIResponse = async (content: string): Promise<string> => {
  content = content.replace(/```json|```/g, '').trim();

  try {
    // First attempt - direct parsing with proper typing
    const jsonData = JSON.parse(content) as unknown;

    // Check if it validates against our schema
    const validationResult = quizDataSchema.safeParse(jsonData);

    if (validationResult.success) {
      console.log('[API] Response validated successfully against schema');
      return JSON.stringify(validationResult.data);
    }

    console.warn(
      '[API] Schema validation failed, attempting to fix structure:',
      validationResult.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(', ')
    );

    // Define a typed interface for the parsed data to avoid 'any' types
    type PartialQuizData = {
      paragraph?: string;
      question?: string;
      options?: {
        A?: string;
        B?: string;
        C?: string;
        D?: string;
      };
      explanations?: {
        A?: string;
        B?: string;
        C?: string;
        D?: string;
      };
      correctAnswer?: string;
      relevantText?: string;
      topic?: string;
    };

    // Type assertion with a more specific type
    const typedJsonData = jsonData as PartialQuizData;

    // Try to repair the structure
    const repairedData = {
      paragraph: typedJsonData.paragraph ?? '',
      question: typedJsonData.question ?? '',
      options: {
        A: typedJsonData.options?.A ?? '',
        B: typedJsonData.options?.B ?? '',
        C: typedJsonData.options?.C ?? '',
        D: typedJsonData.options?.D ?? '',
      },
      explanations: {
        A: typedJsonData.explanations?.A ?? '',
        B: typedJsonData.explanations?.B ?? '',
        C: typedJsonData.explanations?.C ?? '',
        D: typedJsonData.explanations?.D ?? '',
      },
      correctAnswer: typedJsonData.correctAnswer ?? 'A',
      relevantText:
        typedJsonData.relevantText ??
        (typedJsonData.paragraph ? typedJsonData.paragraph.substring(0, 50) : ''),
      topic: typedJsonData.topic ?? 'General topic',
    };

    // Validate the repaired data
    const repairResult = quizDataSchema.safeParse(repairedData);

    if (repairResult.success) {
      console.log('[API] Successfully repaired data structure');
      return JSON.stringify(repairResult.data);
    }

    throw new Error(`Failed to repair data: ${repairResult.error.message}`);
  } catch (error) {
    console.error('[API] JSON parsing/validation error:', error);
    // Throw specific error instead of returning fallback data
    throw new AIResponseProcessingError(
      `Failed to parse or validate AI response: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

/**
 * Extract CEFR level from prompt
 */
export const extractCEFRLevel = async (prompt: string): Promise<string> => {
  const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
  return cefrLevelMatch?.[1] ?? 'unknown';
};

/**
 * Get user ID if user is authenticated
 */
export const getAuthenticatedUserId = async (): Promise<number | null> => {
  try {
    const session = await getServerSession();

    if (session?.user) {
      const userEmail = session.user.email as string | undefined;

      const userRecord = db
        .prepare(
          `
        SELECT id FROM users 
        WHERE (email = ? AND email IS NOT NULL)
        ORDER BY last_login DESC
        LIMIT 1
      `
        )
        .get(userEmail || '') as UserRecord | undefined;

      if (userRecord) {
        console.log(`[API] Request from authenticated user ID: ${userRecord.id}`);
        return userRecord.id;
      }
    }

    return null;
  } catch (error) {
    console.error('[API] Error getting authenticated user:', error);
    return null;
  }
};

/**
 * Main function to generate exercise response
 */
export const generateExerciseResponse = async (params: ExerciseRequestParams) => {
  const parsedBody = exerciseRequestBodySchema.safeParse(params);
  if (!parsedBody.success) {
    console.log('[API] Invalid request body:', parsedBody.error.flatten());
    throw new Error('Invalid request body');
  }

  const { prompt, seed, passageLanguage, questionLanguage, forceCache } = parsedBody.data;

  const userId = await getAuthenticatedUserId();

  const ip = '127.0.0.1';

  const cefrLevel = await extractCEFRLevel(prompt);
  console.log(`[API] Extracted level: ${cefrLevel}`);

  const seedValue = typeof seed === 'number' ? seed : 0;
  const isLoggedIn = userId !== null;

  const initiallyCachedContent = await getCachedExercise(
    passageLanguage,
    questionLanguage,
    cefrLevel,
    seedValue,
    !!forceCache,
    isLoggedIn
  );

  if (initiallyCachedContent) {
    console.log(
      '[API] Content found in cache (initial check):',
      initiallyCachedContent.content.substring(0, 20) + '...'
    );
    await logUsageStats(userId, ip, passageLanguage, cefrLevel);
    return { result: initiallyCachedContent.content };
  }

  console.log(`[API] Content not in cache or forced regeneration, generating new content...`);

  // --- Check Rate Limit Only If Generating ---
  const isWithinRateLimit = await checkRateLimit(ip);
  if (!isWithinRateLimit) {
    console.warn('[API] Rate limit exceeded when attempting generation. Returning error.');
    throw new Error('Rate limit exceeded. Please try again later.');
  }
  console.log('[API] Rate limit check passed for generation.');
  // --- End Rate Limit Check ---

  if (!initiallyCachedContent) {
    await logUsageStats(userId, ip, passageLanguage, cefrLevel);
  }

  try {
    const model = getActiveModel();
    let result: string;

    console.log(`[API] Attempting generation with ${model.provider} model: ${model.name}`);
    if (model.provider === 'openai') {
      result = await generateWithOpenAI(prompt, model);
    } else if (model.provider === 'google') {
      result = await generateWithGoogleAI(prompt, model);
    } else {
      throw new Error(`Unsupported model provider: ${String(model.provider)}`);
    }

    console.log(`[API] Successfully generated and processed content.`);
    await saveGeneratedContent(passageLanguage, questionLanguage, cefrLevel, result);

    return { result };
  } catch (error) {
    console.error('[API] Error during AI generation or processing:', error);

    if (error instanceof AIResponseProcessingError) {
      console.warn('[API] AI response processing failed. Attempting to fetch any cached exercise.');
      const fallbackCachedContent = await getCachedExercise(
        passageLanguage,
        questionLanguage,
        cefrLevel,
        0,
        true,
        isLoggedIn
      );

      if (fallbackCachedContent) {
        console.log('[API] Found fallback cached content.');
        return { result: fallbackCachedContent.content };
      }

      console.error('[API] No fallback cached content found. Re-throwing processing error.');
      throw error;
    } else {
      console.error('[API] Non-AI processing error occurred.');
      throw error;
    }
  }
};
