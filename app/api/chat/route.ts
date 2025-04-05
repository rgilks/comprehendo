import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getServerSession } from 'next-auth';
import {
  getActiveModel,
  getGoogleAIClient,
  getOpenAIClient,
  ModelConfig,
} from '../../../lib/modelConfig';
import OpenAI from 'openai';
import { z } from 'zod';

const MAX_REQUESTS_PER_HOUR = 100;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const CACHE_TTL = 60 * 60 * 24;

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

type OpenAIChatCompletion = OpenAI.Chat.Completions.ChatCompletion;

interface GoogleAIContentResponse {
  response: {
    text: () => string;
  };
}

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
    const session = await getServerSession();
    let userId = null;

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

    const ip =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown-ip';

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
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
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

    const parsedBody = chatRequestBodySchema.safeParse(await request.json());

    if (!parsedBody.success) {
      console.log('[API] Invalid request body:', parsedBody.error.flatten());
      return NextResponse.json(
        {
          error: 'Invalid request body',
          issues: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
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

        // Validate anyLevelContent has the expected structure
        if (
          typeof anyLevelContent === 'object' &&
          anyLevelContent !== null &&
          'content' in anyLevelContent &&
          typeof anyLevelContent.content === 'string' &&
          'created_at' in anyLevelContent &&
          typeof anyLevelContent.created_at === 'string'
        ) {
          console.log(
            `[API] Force cache: found content for this language pair with different level/seed`
          );
          cachedContent = anyLevelContent as GeneratedContentRow;
        }
      }
    }

    if (cachedContent) {
      const timestamp = new Date(cachedContent.created_at).getTime();
      // If forceCache is true, skip the age check and use the cached content regardless of age
      if (forceCache || now - timestamp < CACHE_TTL * 1000) {
        console.log(
          `[API] ${forceCache ? 'Force cache enabled - using cached content' : 'Cache hit'} for key: ${cacheKey}`
        );
        return NextResponse.json({ result: cachedContent.content });
      }
      console.log(`[API] Cache expired for key: ${cacheKey}`);
    } else {
      console.log(`[API] Cache miss for key: ${cacheKey}`);
    }

    console.log('[API] Initializing AI client');

    console.log('[API] Sending request to AI provider');
    const activeModel: ModelConfig = getActiveModel();

    let result: string | null = null;

    if (activeModel.provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        console.error('[API] OpenAI API key is missing');
        return NextResponse.json(
          { error: 'Configuration error: OpenAI API key is missing' },
          { status: 500 }
        );
      }

      const openai = getOpenAIClient();
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
      result = completion?.choices?.[0]?.message?.content ?? null;
    } else if (activeModel.provider === 'google') {
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
      result = googleResponse?.response?.text() ?? null;
    }

    if (result === null) {
      console.error('[API] Failed to get valid content from AI provider');
      return NextResponse.json(
        { error: 'AI provider failed to generate content' },
        { status: 500 }
      );
    }

    console.log(`[API] Received response from ${activeModel.provider}`);

    let parsedContent: Record<string, unknown> = {};
    try {
      const jsonMatch = result.match(/```(?:json)?([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : result.trim();

      const parsedJson: unknown = JSON.parse(jsonString);
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        parsedContent = parsedJson as Record<string, unknown>;
      } else {
        throw new Error('AI result was not a valid JSON object.');
      }
    } catch (parseError) {
      console.error('[API] Failed to parse AI response JSON:', parseError, 'Raw result:', result);
      return NextResponse.json({ error: 'Failed to process AI response format' }, { status: 500 });
    }

    const questionsData = {
      question: parsedContent.question,
      options: parsedContent.options,
      explanations: parsedContent.explanations,
      correctAnswer: parsedContent.correctAnswer,
      relevantText: parsedContent.relevantText,
      topic: parsedContent.topic,
    };

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
        .run(passageLanguage, questionLanguage, cefrLevel, result, JSON.stringify(questionsData));

      console.log(
        `[API] DB Insert Result (generated_content): changes=${insertContentInfo.changes}, lastInsertRowid=${insertContentInfo.lastInsertRowid}`
      );
      if (insertContentInfo.changes > 0) {
        contentInsertSuccessful = true;
        console.log('[API] Successfully inserted generated_content (Marked success).');
      } else {
        console.warn('[API] DB Insert for generated_content reported 0 changes.');
      }
    } catch (contentError) {
      console.error('[API] CRITICAL ERROR during generated_content insert:', contentError);
    }

    console.log(
      `[API] Recording usage statistics for passage: ${passageLanguage}, question: ${questionLanguage}, level: ${cefrLevel}${
        userId ? ', user: ' + userId : ''
      }`
    );

    if (contentInsertSuccessful) {
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
