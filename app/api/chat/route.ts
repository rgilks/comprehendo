import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { getServerSession } from 'next-auth';
import {
  getActiveModel,
  getGoogleAIClient,
  getOpenAIClient,
  ModelConfig,
} from '../../../lib/modelConfig';
import OpenAI from 'openai';
import { z } from 'zod';

// Don't initialize OpenAI at build time
// const getOpenAIClient = () => {
//   return new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
//   });
// };

// Simple in-memory rate limiter
// Maps IP addresses to timestamps of their requests
const MAX_REQUESTS_PER_HOUR = 100; // Adjust as needed
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds

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

// Define Zod schema for the request body
const chatRequestBodySchema = z.object({
  prompt: z.string().min(1, { message: 'Prompt is required' }),
  seed: z.number().optional(),
  passageLanguage: z.string(),
  questionLanguage: z.string(),
});

// Define a type for the successful OpenAI completion structure we expect
// (Only include properties actually accessed)
type OpenAIChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

// Define a type for the successful Google AI response structure we expect
// (Only include properties actually accessed)
interface GoogleAIContentResponse {
  response: {
    text: () => string;
  };
}

// Initialize rate limiting table
console.log('[API] Initializing rate limiting table...');
db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    requests TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('[API] Rate limiting table initialized');

export async function POST(request: Request) {
  try {
    // Get user session if available
    const session = await getServerSession();
    let userId = null;

    // Get user ID from database if logged in
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

    // Get IP address from headers
    const ip =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown-ip';

    // Truncate IP or mask it for privacy in logs
    const logSafeIp = ip.length > 20 ? ip.substring(0, 20) + '...' : ip;
    console.log(`[API] Request from IP: ${logSafeIp}`);

    // Check rate limit
    const now = Date.now();
    let userRequests: number[] = [];

    // Get rate limit data from database
    console.log(`[API] Checking rate limit for IP: ${logSafeIp}`);
    const rateLimitRow = db
      .prepare('SELECT requests, updated_at FROM rate_limits WHERE ip_address = ?')
      .get(ip) as RateLimitRow | undefined;

    if (rateLimitRow) {
      // Provide type for JSON.parse result
      try {
        // Initialize with unknown, then check type
        const parsedRequests: unknown = JSON.parse(rateLimitRow.requests);
        // Basic type check for safety
        if (
          Array.isArray(parsedRequests) &&
          parsedRequests.every((item) => typeof item === 'number')
        ) {
          userRequests = parsedRequests; // Assign directly
        } else {
          console.warn(`[API] Invalid rate limit data found for IP ${logSafeIp}. Resetting.`);
          userRequests = []; // Reset if data is corrupt
        }
      } catch (parseError) {
        console.error(`[API] Failed to parse rate limit data for IP ${logSafeIp}:`, parseError);
        userRequests = []; // Reset on parse error
      }
      console.log(`[API] Found ${userRequests.length} previous requests for IP: ${logSafeIp}`);

      // Update last updated timestamp
      db.prepare('UPDATE rate_limits SET updated_at = CURRENT_TIMESTAMP WHERE ip_address = ?').run(
        ip
      );
    }

    // Filter out requests older than the rate limit window
    const recentRequests = userRequests.filter(
      (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
    );
    console.log(`[API] ${recentRequests.length} recent requests for IP: ${logSafeIp}`);

    // Check if user has exceeded rate limit
    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.log(`[API] Rate limit exceeded for IP: ${logSafeIp}`);
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Update rate limit tracking in database
    const updatedRequests = [...recentRequests, now];
    console.log(
      `[API] Updating rate limit for IP: ${logSafeIp} with ${updatedRequests.length} requests`
    );

    // Use upsert pattern to either insert or update
    db.prepare(
      `
      INSERT INTO rate_limits (ip_address, requests, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip_address) DO UPDATE SET
      requests = ?, updated_at = CURRENT_TIMESTAMP
    `
    ).run(ip, JSON.stringify(updatedRequests), JSON.stringify(updatedRequests));

    // Use the Zod schema to parse and validate the request body
    const parsedBody = chatRequestBodySchema.safeParse(await request.json());

    if (!parsedBody.success) {
      // If validation fails, return a 400 error with Zod's error messages
      console.log('[API] Invalid request body:', parsedBody.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid request body',
          issues: parsedBody.error.flatten().fieldErrors, // Send specific issues back
        },
        { status: 400 }
      );
    }

    // Use the validated data
    const { prompt, seed, passageLanguage, questionLanguage } = parsedBody.data;

    // Log the received prompt safely
    console.log(`[API] Received request with prompt: ${prompt.substring(0, 50)}...`);
    // Log received languages
    console.log(
      `[API] Passage Language: ${passageLanguage}, Question Language: ${questionLanguage}`
    );

    // Extract CEFR level from the prompt (assuming it's still reliable)
    const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
    const cefrLevel = cefrLevelMatch?.[1] ?? 'unknown';
    console.log(`[API] Extracted level: ${cefrLevel}`);

    // Create a cache key including both languages, level, and seed
    const seedValue = typeof seed === 'number' ? seed : 0;
    const cacheKey = `${passageLanguage}-${questionLanguage}-${cefrLevel}-${seedValue}`;
    console.log(`[API] Checking cache for key: ${cacheKey}`);

    // Check cache in database, now including question_language
    const resultFromDb: unknown = db
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
      .get(passageLanguage, questionLanguage, cefrLevel, seedValue % 100);

    let cachedContent: GeneratedContentRow | undefined = undefined;

    // Type guard for the database result
    if (
      typeof resultFromDb === 'object' &&
      resultFromDb !== null &&
      'content' in resultFromDb &&
      typeof resultFromDb.content === 'string' &&
      'created_at' in resultFromDb &&
      typeof resultFromDb.created_at === 'string'
      // Add other property checks from GeneratedContentRow if needed for full safety
    ) {
      cachedContent = resultFromDb as GeneratedContentRow; // Cast only after check
    }

    if (cachedContent) {
      const timestamp = new Date(cachedContent.created_at).getTime();
      // Check if cache is still valid (less than CACHE_TTL old)
      if (now - timestamp < CACHE_TTL * 1000) {
        console.log(`[API] Cache hit for key: ${cacheKey}`);
        return NextResponse.json({ result: cachedContent.content });
      }
      console.log(`[API] Cache expired for key: ${cacheKey}`);
    } else {
      console.log(`[API] Cache miss for key: ${cacheKey}`);
    }

    // Initialize OpenAI only when the route is called
    console.log('[API] Initializing AI client');
    // const openai = getOpenAIClient();

    console.log('[API] Sending request to AI provider');
    // Get the active model configuration
    const activeModel: ModelConfig = getActiveModel();

    let result: string | null = null;

    if (activeModel.provider === 'openai') {
      // Check if API key is available
      if (!process.env.OPENAI_API_KEY) {
        console.error('[API] OpenAI API key is missing');
        return NextResponse.json(
          { error: 'Configuration error: OpenAI API key is missing' },
          { status: 500 }
        );
      }

      const openai = getOpenAIClient();
      // Use the defined type for the completion result
      const completion: OpenAIChatCompletion = await openai.chat.completions.create({
        model: activeModel.name,
        messages: [
          {
            role: 'system',
            content: `You are a helpful language tutor for a reading comprehension game. Create content based on the CEFR level and the TWO languages specified in the user prompt.\\n\\nFollow these guidelines for different CEFR levels:\\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.\\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\\n\\nIMPORTANT FORMATTING INSTRUCTIONS:\\n1. Generate the reading PARAGRAPH ONLY in the FIRST language specified (e.g., Italian, Spanish, etc.).\\n2. Generate the QUESTION, OPTIONS, and EXPLANATIONS ONLY in the SECOND language specified.\\n\\nCreate direct, clear comprehension questions that:\\n- Have one unmistakably correct answer that comes directly from the text\\n- Test simple comprehension rather than inference or interpretation\\n- Focus on key details from the paragraph\\n- Have plausible but clearly incorrect distractors\\n\\nCreate content in the following format ONLY:\\n\\n1. A paragraph in the requested FIRST language on an interesting topic appropriate for the requested CEFR level\\n2. A multiple choice question in the requested SECOND language that tests direct comprehension of the paragraph\\n3. Four possible answers in the requested SECOND language labeled A, B, C, and D\\n4. The correct answer letter\\n5. A short topic description for image generation (3-5 words in English, regardless of other languages)\\n6. For each option, provide a brief explanation in the requested SECOND language of why it is correct or incorrect\\n7. Include the exact text from the paragraph (a quote in the original FIRST language) that supports the correct answer\\n\\nFormat your response exactly like this (including the JSON format). Ensure the entire response is a single, valid JSON object. Use ONLY double quotes for all strings and property names. Escape any double quotes that appear inside string values with a backslash (\\\").\\n\\\`\\\`\\\`json\\n{\\n  \"paragraph\": \"your paragraph text here in the requested FIRST language\",\\n  \"question\": \"your question about the paragraph here IN THE SECOND language\",\\n  \"options\": {\\n    \"A\": \"first option IN THE SECOND language\",\\n    \"B\": \"second option IN THE SECOND language\",\\n    \"C\": \"third option IN THE SECOND language\",\\n    \"D\": \"fourth option IN THE SECOND language\"\\n  },\\n  \"explanations\": {\\n    \"A\": \"Explanation of why A is correct/incorrect IN THE SECOND language\",\\n    \"B\": \"Explanation of why B is correct/incorrect IN THE SECOND language\",\\n    \"C\": \"Explanation of why C is correct/incorrect IN THE SECOND language\",\\n    \"D\": \"Explanation of why D is correct/incorrect IN THE SECOND language\"\\n  },\\n  \"correctAnswer\": \"B\",\\n  \"relevantText\": \"Exact quote from the paragraph that supports the correct answer in the original FIRST language\",\\n  \"topic\": \"brief topic for image IN ENGLISH\"\\n}\\n\\\`\\\`\\\`\\n\\nVary the topics and ensure the correct answer isn\\\'t always the same letter. Make the question challenging but clearly answerable from the paragraph. Keep language appropriate for the specified CEFR level.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: activeModel.maxTokens,
      });
      // Access content safely using optional chaining
      result = completion?.choices?.[0]?.message?.content ?? null;
    } else if (activeModel.provider === 'google') {
      // Check if API key is available
      if (!process.env.GOOGLE_AI_API_KEY) {
        console.error('[API] Google AI API key is missing');
        return NextResponse.json(
          { error: 'Configuration error: Google AI API key is missing' },
          { status: 500 }
        );
      }

      const googleAI = getGoogleAIClient();
      const model = googleAI.getGenerativeModel({ model: activeModel.name });

      const systemPrompt = `You are a helpful language tutor for a reading comprehension game. Create content based on the CEFR level and the TWO languages specified in the user prompt.\\n\\nFollow these guidelines for different CEFR levels:\\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.\\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\\n\\nIMPORTANT FORMATTING INSTRUCTIONS:\\n1. Generate the reading PARAGRAPH ONLY in the FIRST language specified (e.g., Italian, Spanish, etc.).\\n2. Generate the QUESTION, OPTIONS, and EXPLANATIONS ONLY in the SECOND language specified.\\n\\nCreate direct, clear comprehension questions that:\\n- Have one unmistakably correct answer that comes directly from the text\\n- Test simple comprehension rather than inference or interpretation\\n- Focus on key details from the paragraph\\n- Have plausible but clearly incorrect distractors\\n\\nCreate content in the following format ONLY:\\n\\n1. A paragraph in the requested FIRST language on an interesting topic appropriate for the requested CEFR level\\n2. A multiple choice question in the requested SECOND language that tests direct comprehension of the paragraph\\n3. Four possible answers in the requested SECOND language labeled A, B, C, and D\\n4. The correct answer letter\\n5. A short topic description for image generation (3-5 words in English, regardless of other languages)\\n6. For each option, provide a brief explanation in the requested SECOND language of why it is correct or incorrect\\n7. Include the exact text from the paragraph (a quote in the original FIRST language) that supports the correct answer\\n\\nFormat your response exactly like this (including the JSON format). Ensure the entire response is a single, valid JSON object. Use ONLY double quotes for all strings and property names. Escape any double quotes that appear inside string values with a backslash (\\\").\\n\\\`\\\`\\\`json\\n{\\n  \"paragraph\": \"your paragraph text here in the requested FIRST language\",\\n  \"question\": \"your question about the paragraph here IN THE SECOND language\",\\n  \"options\": {\\n    \"A\": \"first option IN THE SECOND language\",\\n    \"B\": \"second option IN THE SECOND language\",\\n    \"C\": \"third option IN THE SECOND language\",\\n    \"D\": \"fourth option IN THE SECOND language\"\\n  },\\n  \"explanations\": {\\n    \"A\": \"Explanation of why A is correct/incorrect IN THE SECOND language\",\\n    \"B\": \"Explanation of why B is correct/incorrect IN THE SECOND language\",\\n    \"C\": \"Explanation of why C is correct/incorrect IN THE SECOND language\",\\n    \"D\": \"Explanation of why D is correct/incorrect IN THE SECOND language\"\\n  },\\n  \"correctAnswer\": \"B\",\\n  \"relevantText\": \"Exact quote from the paragraph that supports the correct answer in the original FIRST language\",\\n  \"topic\": \"brief topic for image IN ENGLISH\"\\n}\\n\\\`\\\`\\\`\\n\\nVary the topics and ensure the correct answer isn\\\'t always the same letter. Make the question challenging but clearly answerable from the paragraph. Keep language appropriate for the specified CEFR level.`;

      const googleResponse: GoogleAIContentResponse = await model.generateContent(
        systemPrompt + '\n\n' + prompt
      ); // Combine prompts for Google
      // Access content safely using optional chaining and calling the function
      result = googleResponse?.response?.text() ?? null;
    }

    // Check if result is valid before proceeding
    if (result === null) {
      console.error('[API] Failed to get valid content from AI provider');
      return NextResponse.json(
        { error: 'AI provider failed to generate content' },
        { status: 500 }
      );
    }

    console.log(`[API] Received response from ${activeModel.provider}`);

    // Parse the result JSON to extract questions and other details
    let parsedContent: Record<string, unknown> = {}; // Use a broader type initially
    try {
      // More robustly find JSON within potential markdown fences
      const jsonMatch = result.match(/```(?:json)?([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : result.trim(); // Extract or use original

      // Provide type safety for JSON.parse result
      const parsedJson: unknown = JSON.parse(jsonString); // Parse the extracted/trimmed string
      // Check if it's an object before assigning
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        parsedContent = parsedJson as Record<string, unknown>; // Cast after check
      } else {
        throw new Error('AI result was not a valid JSON object.');
      }
    } catch (parseError) {
      console.error('[API] Failed to parse AI response JSON:', parseError, 'Raw result:', result);
      // Handle the error appropriately, maybe return a 500 response
      return NextResponse.json({ error: 'Failed to process AI response format' }, { status: 500 });
    }

    // Extract relevant fields for the 'questions' column
    const questionsData = {
      question: parsedContent.question,
      options: parsedContent.options,
      explanations: parsedContent.explanations,
      correctAnswer: parsedContent.correctAnswer,
      relevantText: parsedContent.relevantText,
      topic: parsedContent.topic,
      // Add any other fields from the parsed JSON you might want to store
    };

    // Store the result and the structured questions in the database
    console.log(
      `[API] Storing generated content in database for passage: ${passageLanguage}, question: ${questionLanguage}, level: ${cefrLevel}`
    );
    console.log('[API] Preparing to insert generated_content...');

    let contentInsertSuccessful = false;
    try {
      const insertContentInfo = db
        .prepare(
          `
          INSERT INTO generated_content (language, question_language, level, content, questions, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
        )
        .run(
          passageLanguage, // language column now stores passage language
          questionLanguage, // new question_language column
          cefrLevel,
          result,
          JSON.stringify(questionsData)
        );

      console.log(
        `[API] DB Insert Result (generated_content): changes=${insertContentInfo.changes}, lastInsertRowid=${insertContentInfo.lastInsertRowid}`
      );
      // Only mark successful if changes > 0
      if (insertContentInfo.changes > 0) {
        contentInsertSuccessful = true;
        console.log('[API] Successfully inserted generated_content (Marked success).');
      } else {
        console.warn('[API] DB Insert for generated_content reported 0 changes.');
      }
    } catch (contentError) {
      console.error('[API] CRITICAL ERROR during generated_content insert:', contentError);
      // Optionally, you might want to return a 500 error here
      // return NextResponse.json({ error: "Database error saving content" }, { status: 500 });
    }

    // Track usage statistics with user ID when available
    console.log(
      `[API] Recording usage statistics for passage: ${passageLanguage}, question: ${questionLanguage}, level: ${cefrLevel}${
        userId ? ', user: ' + userId : ''
      }`
    );

    if (contentInsertSuccessful) {
      // Optionally, only try inserting stats if content insert seemed okay
      console.log(
        `[API] Recording usage statistics for passage: ${passageLanguage}, question: ${questionLanguage}, level: ${cefrLevel}${userId ? ', user: ' + userId : ''}`
      );

      try {
        console.log('[API] Preparing to insert usage_stats (with user_id if available)...');
        const insertStatsInfo1 = db
          .prepare(
            `
            INSERT INTO usage_stats (ip_address, user_id, language, level)
            VALUES (?, ?, ?, ?)
          `
          )
          .run(ip, userId, passageLanguage, cefrLevel);
        console.log(
          `[API] DB Insert Result (usage_stats with user_id): changes=${insertStatsInfo1.changes}, lastInsertRowid=${insertStatsInfo1.lastInsertRowid}`
        );
        if (insertStatsInfo1.changes > 0) {
          console.log('[API] Successfully inserted usage_stats (with user_id attempt).');
        } else {
          console.warn('[API] DB Insert for usage_stats (with user_id) reported 0 changes.');
        }
      } catch (error) {
        console.error('[API] Error recording usage stats with user_id, trying fallback:', error);
        try {
          console.log('[API] Preparing to insert usage_stats (fallback without user_id)...');
          const insertStatsInfo2 = db
            .prepare(
              `
              INSERT INTO usage_stats (ip_address, language, level)
              VALUES (?, ?, ?)
            `
            )
            .run(ip, passageLanguage, cefrLevel);
          console.log(
            `[API] DB Insert Result (usage_stats fallback): changes=${insertStatsInfo2.changes}, lastInsertRowid=${insertStatsInfo2.lastInsertRowid}`
          );
          if (insertStatsInfo2.changes > 0) {
            console.log('[API] Successfully inserted usage_stats (fallback attempt).');
          } else {
            console.warn('[API] DB Insert for usage_stats (fallback) reported 0 changes.');
          }
        } catch (fallbackError) {
          console.error('[API] CRITICAL ERROR during usage_stats fallback insert:', fallbackError);
        }
      }
    } else {
      console.warn(
        '[API] Skipping usage_stats insert because generated_content insert failed or reported 0 changes.'
      );
    }

    console.log('[API] Request completed successfully (reached end of try block).');
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[API] Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
