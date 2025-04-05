'use server';

import { z } from 'zod';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import { getActiveModel, getGoogleAIClient, getOpenAIClient, ModelConfig } from '@/lib/modelConfig';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

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

const chatRequestBodySchema = z.object({
  prompt: z.string().min(1, { message: 'Prompt is required' }),
  seed: z.number().optional(),
  passageLanguage: z.string(),
  questionLanguage: z.string(),
  forceCache: z.boolean().optional(),
});

export type ChatRequestParams = z.infer<typeof chatRequestBodySchema>;

// Define the Quiz data schema to validate responses
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

export async function generateChatResponse(params: ChatRequestParams) {
  try {
    const session = await getServerSession();
    let userId = null;

    // Initialize DB table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        ip_address TEXT PRIMARY KEY,
        requests TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    if (session?.user) {
      const userEmail = session.user.email as string | undefined;

      interface UserRecord {
        id: number;
      }

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
        userId = userRecord.id;
        console.log(`[API] Request from authenticated user ID: ${userId}`);
      }
    }

    // IP address - use '127.0.0.1' for server actions since we can't get client IP
    const ip = '127.0.0.1';

    const logSafeIp = ip.length > 20 ? ip.substring(0, 20) + '...' : ip;
    console.log(`[API] Request from IP: ${logSafeIp}`);

    const now = Date.now();
    let userRequests: number[] = [];

    console.log(`[API] Checking rate limit for IP: ${logSafeIp}`);
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
          console.warn(`[API] Invalid rate limit data found for IP ${logSafeIp}. Resetting.`);
          userRequests = [];
        }
      } catch (parseError) {
        console.error(`[API] Failed to parse rate limit data for IP ${logSafeIp}:`, parseError);
        userRequests = [];
      }
      console.log(`[API] Found ${userRequests.length} previous requests for IP: ${logSafeIp}`);

      db.prepare('UPDATE rate_limits SET updated_at = CURRENT_TIMESTAMP WHERE ip_address = ?').run(
        ip
      );
    }

    const recentRequests = userRequests.filter(
      (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
    );
    console.log(`[API] ${recentRequests.length} recent requests for IP: ${logSafeIp}`);

    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.log(`[API] Rate limit exceeded for IP: ${logSafeIp}`);
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const updatedRequests = [...recentRequests, now];
    console.log(
      `[API] Updating rate limit for IP: ${logSafeIp} with ${updatedRequests.length} requests`
    );

    db.prepare(
      `
      INSERT INTO rate_limits (ip_address, requests, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip_address) DO UPDATE SET
      requests = ?, updated_at = CURRENT_TIMESTAMP
    `
    ).run(ip, JSON.stringify(updatedRequests), JSON.stringify(updatedRequests));

    const parsedBody = chatRequestBodySchema.safeParse(params);

    if (!parsedBody.success) {
      console.log('[API] Invalid request body:', parsedBody.error.flatten());
      throw new Error('Invalid request body');
    }

    const { prompt, seed, passageLanguage, questionLanguage, forceCache } = parsedBody.data;

    console.log(`[API] Received request with prompt: ${prompt.substring(0, 50)}...`);
    console.log(
      `[API] Passage Language: ${passageLanguage}, Question Language: ${questionLanguage}`
    );
    if (forceCache) {
      console.log(
        '[API] Force cache option enabled - will use cached content if available regardless of age'
      );
    }

    const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
    const cefrLevel = cefrLevelMatch?.[1] ?? 'unknown';
    console.log(`[API] Extracted level: ${cefrLevel}`);

    const seedValue = typeof seed === 'number' ? seed : 0;
    const cacheKey = `${passageLanguage}-${questionLanguage}-${cefrLevel}-${seedValue}`;
    console.log(`[API] Checking cache for key: ${cacheKey}`);

    // Function to get cached content with optional level override
    const getCachedContent = (level: string) => {
      const result = db
        .prepare(
          `
        SELECT content, created_at FROM generated_content \
        WHERE language = ? \
          AND question_language = ? \
          AND level = ? \
          AND id % 100 = ?\
        ORDER BY created_at DESC LIMIT 1
      `
        )
        .get(passageLanguage, questionLanguage, level, seedValue % 100);

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
    let cachedContent = getCachedContent(cefrLevel);

    // If forceCache is true and no content found, try with surrounding CEFR levels
    if (forceCache && !cachedContent) {
      console.log(
        `[API] Force cache enabled but no content for ${cefrLevel}, trying nearby levels`
      );
      const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const currentIndex = cefrLevels.indexOf(cefrLevel);

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
          SELECT content, created_at FROM generated_content \
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

    if (cachedContent) {
      console.log('[API] Content found in cache:', cachedContent.content.substring(0, 20) + '...');

      // Log the reuse in usage_stats
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
          ).run(userId, ip, passageLanguage, cefrLevel);

          console.log(`[API] Logged cache usage in stats for user ${userId}`);
        } catch (error) {
          console.error('[API] Error logging usage stats:', error);
          // Continue even if logging fails
        }
      }

      return { result: cachedContent.content };
    }

    // Not found in cache, call the LLM
    console.log(`[API] Content not in cache, generating new content...`);

    // Use the active model from config
    const model = getActiveModel();
    let result: string;

    // Insert usage stats
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
        ).run(userId, ip, passageLanguage, cefrLevel);

        console.log(`[API] Logged content generation in stats for user ${userId}`);
      } catch (error) {
        console.error('[API] Error logging usage stats:', error);
        // Continue even if logging fails
      }
    }

    if (model.provider === 'openai') {
      console.log(`[API] Using OpenAI model: ${model.name}`);
      result = await generateWithOpenAI(prompt, model);
    } else if (model.provider === 'google') {
      console.log(`[API] Using Google AI model: ${model.name}`);
      result = await generateWithGoogleAI(prompt, model);
    } else {
      throw new Error(`Unsupported model provider: ${String(model.provider)}`);
    }

    // Save the generated content to the database
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

      // Extract questions from content to save separately
      // This is needed because the database schema requires a non-NULL questions field
      let questions = '';
      try {
        // Try to parse the content as JSON to extract questions
        const contentStr = result.replace(/```json|```/g, '').trim();
        const content = JSON.parse(contentStr) as QuizContent;

        if (content.options || content.question) {
          // Extract questions part
          questions = JSON.stringify({
            question: content.question || '',
            options: content.options || {},
            explanations: content.explanations || {},
            correctAnswer: content.correctAnswer || '',
            relevantText: content.relevantText || '',
            topic: content.topic || '',
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
        .get(passageLanguage, cefrLevel, result, questions, questionLanguage) as
        | { id: number }
        | undefined;

      if (savedId) {
        console.log(`[API] Saved generated content to database with ID: ${savedId.id}`);
      } else {
        console.warn('[API] Failed to save generated content to database');
      }
    } catch (dbError) {
      console.error('[API] Error saving content to database:', dbError);
      // Continue even if saving fails
    }

    return { result };
  } catch (error) {
    console.error('[API] Error in generateChatResponse:', error);
    throw error;
  }
}

async function generateWithOpenAI(prompt: string, model: ModelConfig): Promise<string> {
  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: model.name,
      messages: [
        {
          role: 'system',
          content:
            'You are a language learning assistant that creates reading comprehension exercises. Always format your response as valid JSON without markdown code blocks. The JSON must include: paragraph, question, options (A,B,C,D), explanations (A,B,C,D), correctAnswer, relevantText, and topic fields.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    // Process and validate the response
    return processAIResponse(completion.choices[0].message.content || '');
  } catch (error) {
    console.error('[API] OpenAI generation error:', error);
    throw new Error('Error generating content with OpenAI');
  }
}

async function generateWithGoogleAI(prompt: string, model: ModelConfig): Promise<string> {
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
- paragraph: the text passage
- question: the comprehension question
- options: an object with keys A, B, C, D containing answer choices
- explanations: an object with keys A, B, C, D explaining each answer
- correctAnswer: one of "A", "B", "C", or "D"
- relevantText: the part of paragraph that answers the question
- topic: a brief description of the topic`,
            },
          ],
        },
      ],
    });

    // Process and validate the response
    return processAIResponse(result.response.text());
  } catch (error) {
    console.error('[API] Google AI generation error:', error);
    throw new Error('Error generating content with Google AI');
  }
}

// Helper function to process and validate AI responses
function processAIResponse(content: string): string {
  // Remove markdown formatting
  content = content.replace(/```json|```/g, '').trim();

  // Try to parse and validate the content
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

    // Last resort - create a valid fallback response
    const fallbackData = {
      paragraph: "This is a fallback paragraph due to an error processing the AI's response.",
      question: 'What happened to the original content?',
      options: {
        A: 'There was an error in the AI response format.',
        B: 'The content was too complex to parse.',
        C: 'The server encountered a technical issue.',
        D: 'The question was not appropriate for the system.',
      },
      explanations: {
        A: "This is correct. The AI generated content that couldn't be properly formatted.",
        B: 'This might be part of the issue, but the main problem was a formatting error.',
        C: 'This is partially correct, but specifically related to response formatting.',
        D: 'This is incorrect. The question was appropriate but the response had formatting issues.',
      },
      correctAnswer: 'A',
      relevantText: "This is a fallback paragraph due to an error processing the AI's response.",
      topic: 'Error handling',
    };

    console.log('[API] Using fallback data due to parsing errors');
    return JSON.stringify(fallbackData);
  }
}
