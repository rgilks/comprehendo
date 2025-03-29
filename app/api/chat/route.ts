import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { getServerSession } from 'next-auth';
import {
  getActiveModel,
  getGoogleAIClient,
  getOpenAIClient,
  ModelConfig,
} from '../../../lib/modelConfig';

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
      userRequests = JSON.parse(rateLimitRow.requests);
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

    const body = await request.json();
    const { prompt, seed } = body;
    console.log(`[API] Received request with prompt: ${prompt.substring(0, 50)}...`);

    if (!prompt) {
      console.log('[API] Error: No prompt provided');
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Extract CEFR level and language from the prompt for better caching
    const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
    const languageMatch = prompt.match(/paragraph in ([A-Za-z]+)/);

    const cefrLevel = cefrLevelMatch ? cefrLevelMatch[1] : 'unknown';
    const language = languageMatch ? languageMatch[1] : 'unknown';
    console.log(`[API] Extracted language: ${language}, level: ${cefrLevel}`);

    // Create a cache key from the CEFR level, language, and seed for better variety
    const cacheKey = `${language}-${cefrLevel}-${seed || 0}`;
    console.log(`[API] Checking cache for key: ${cacheKey}`);

    // Check cache in database
    const cachedContent = db
      .prepare(
        `
      SELECT content, created_at FROM generated_content 
      WHERE language = ? AND level = ? AND id % 100 = ?
      ORDER BY created_at DESC LIMIT 1
    `
      )
      .get(language, cefrLevel, seed % 100 || 0) as GeneratedContentRow | undefined;

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

    // Create completion based on model provider
    let completion;
    let result;

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
      completion = await openai.chat.completions.create({
        model: activeModel.name,
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful language tutor for a reading comprehension game. Create content based on the language and CEFR level specified in the user prompt.\n\nThe user will specify a language (like English, Italian, Spanish, etc.) and a CEFR level (A1-C2).\n\nFollow these guidelines for different CEFR levels:\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\n\nIMPORTANT FORMATTING INSTRUCTIONS:\n1. Generate the paragraph in the language requested by the user (e.g., Italian, Spanish, etc.)\n2. Generate the question and all answers in ENGLISH, regardless of the paragraph language\n\nCreate direct, clear comprehension questions that:\n- Have one unmistakably correct answer that comes directly from the text\n- Test simple comprehension rather than inference or interpretation\n- Focus on key details from the paragraph\n- Have plausible but clearly incorrect distractors\n\nCreate content in the following format ONLY:\n\n1. A paragraph in the requested language on an interesting topic appropriate for the requested CEFR level\n2. A multiple choice question IN ENGLISH that tests direct comprehension of the paragraph\n3. Four possible answers IN ENGLISH labeled A, B, C, and D\n4. The correct answer letter\n5. A short topic description for image generation (3-5 words in English)\n6. For each option, provide a brief explanation IN ENGLISH of why it is correct or incorrect\n7. Include the exact text from the paragraph (a quote in the original language) that supports the correct answer\n\nFormat your response exactly like this (including the JSON format):\n```json\n{\n  "paragraph": "your paragraph text here in the requested language",\n  "question": "your question about the paragraph here IN ENGLISH",\n  "options": {\n    "A": "first option IN ENGLISH",\n    "B": "second option IN ENGLISH",\n    "C": "third option IN ENGLISH",\n    "D": "fourth option IN ENGLISH"\n  },\n  "explanations": {\n    "A": "Explanation of why A is correct/incorrect IN ENGLISH",\n    "B": "Explanation of why B is correct/incorrect IN ENGLISH",\n    "C": "Explanation of why C is correct/incorrect IN ENGLISH",\n    "D": "Explanation of why D is correct/incorrect IN ENGLISH"\n  },\n  "correctAnswer": "B",\n  "relevantText": "Exact quote from the paragraph that supports the correct answer in the original language",\n  "topic": "brief topic for image IN ENGLISH"\n}\n```\n\nEXAMPLES:\n\nExample for Italian (B1 level):\n```json\n{\n  "paragraph": "Milano è una città famosa per la moda e il design. Ogni anno, migliaia di visitatori vengono per vedere le nuove collezioni. Il Duomo è il monumento più conosciuto della città. La gente può salire sul tetto per ammirare il panorama.",\n  "question": "Why do thousands of visitors come to Milan every year?",\n  "options": {\n    "A": "To visit the Duomo cathedral",\n    "B": "To see new fashion collections",\n    "C": "To admire the view from rooftops",\n    "D": "To study design at universities"\n  },\n  "explanations": {\n    "A": "Incorrect. While the Duomo is mentioned as the most famous monument, it\'s not stated as the reason thousands visit.",\n    "B": "Correct. The paragraph states that thousands of visitors come to see the new collections.",\n    "C": "Incorrect. While people can climb the Duomo to see the view, this is not mentioned as why thousands visit annually.",\n    "D": "Incorrect. Universities are not mentioned in the paragraph."\n  },\n  "correctAnswer": "B",\n  "relevantText": "Ogni anno, migliaia di visitatori vengono per vedere le nuove collezioni.",\n  "topic": "Milan fashion"\n}\n```\n\nVary the topics and ensure the correct answer isn\'t always the same letter. Make the question challenging but clearly answerable from the paragraph. Keep language appropriate for the specified CEFR level.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: activeModel.maxTokens,
      });
      result = completion.choices[0].message.content;
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

      const systemPrompt = `You are a helpful language tutor for a reading comprehension game. Create content based on the language and CEFR level specified in the user prompt.

The user will specify a language (like English, Italian, Spanish, etc.) and a CEFR level (A1-C2).

Follow these guidelines for different CEFR levels:
- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.
- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.
- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.
- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.
- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.
- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.

IMPORTANT FORMATTING INSTRUCTIONS:
1. Generate the paragraph in the language requested by the user (e.g., Italian, Spanish, etc.)
2. Generate the question and all answers in ENGLISH, regardless of the paragraph language

Create direct, clear comprehension questions that:
- Have one unmistakably correct answer that comes directly from the text
- Test simple comprehension rather than inference or interpretation
- Focus on key details from the paragraph
- Have plausible but clearly incorrect distractors

Create content in the following format ONLY:

1. A paragraph in the requested language on an interesting topic appropriate for the requested CEFR level
2. A multiple choice question IN ENGLISH that tests direct comprehension of the paragraph
3. Four possible answers IN ENGLISH labeled A, B, C, and D
4. The correct answer letter
5. A short topic description for image generation (3-5 words in English)
6. For each option, provide a brief explanation IN ENGLISH of why it is correct or incorrect
7. Include the exact text from the paragraph (a quote in the original language) that supports the correct answer

Format your response exactly like this (including the JSON format):
\`\`\`json
{
  "paragraph": "your paragraph text here in the requested language",
  "question": "your question about the paragraph here IN ENGLISH",
  "options": {
    "A": "first option IN ENGLISH",
    "B": "second option IN ENGLISH",
    "C": "third option IN ENGLISH",
    "D": "fourth option IN ENGLISH"
  },
  "explanations": {
    "A": "Explanation of why A is correct/incorrect IN ENGLISH",
    "B": "Explanation of why B is correct/incorrect IN ENGLISH",
    "C": "Explanation of why C is correct/incorrect IN ENGLISH",
    "D": "Explanation of why D is correct/incorrect IN ENGLISH"
  },
  "correctAnswer": "B",
  "relevantText": "Exact quote from the paragraph that supports the correct answer in the original language",
  "topic": "brief topic for image IN ENGLISH"
}
\`\`\``;

      const combinedPrompt = `${systemPrompt}\n\n${prompt}`;
      const response = await model.generateContent(combinedPrompt);
      result = response.response.text();
    }

    console.log(`[API] Received response from ${activeModel.provider}`);

    // Store the result in database - truncate result for logging
    console.log(
      `[API] Storing generated content in database for language: ${language}, level: ${cefrLevel}`
    );
    db.prepare(
      `
      INSERT INTO generated_content (language, level, content, questions, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(language, cefrLevel, result, JSON.stringify({ prompt }));

    // Track usage statistics with user ID when available
    console.log(
      `[API] Recording usage statistics for language: ${language}, level: ${cefrLevel}${
        userId ? ', user: ' + userId : ''
      }`
    );

    try {
      db.prepare(
        `
        INSERT INTO usage_stats (ip_address, user_id, language, level)
        VALUES (?, ?, ?, ?)
      `
      ).run(ip, userId, language, cefrLevel);
    } catch (error) {
      // Fallback to the original query without user_id if there's an error
      console.error('[API] Error recording usage stats with user_id, trying without:', error);
      try {
        db.prepare(
          `
          INSERT INTO usage_stats (ip_address, language, level)
          VALUES (?, ?, ?)
        `
        ).run(ip, language, cefrLevel);
      } catch (fallbackError) {
        console.error('[API] Error recording usage stats:', fallbackError);
        // Continue execution - don't fail the request just because stats recording failed
      }
    }

    console.log('[API] Request completed successfully');
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[API] Error in chat API:', error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}
