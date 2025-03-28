import { OpenAI } from "openai";
import { NextResponse } from "next/server";
import db from "../../../lib/db";
import Database from "better-sqlite3";

// Don't initialize OpenAI at build time
const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

// Simple in-memory rate limiter
// Maps IP addresses to timestamps of their requests
const rateLimits = new Map();
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
console.log("[API] Initializing rate limiting table...");
db.exec(`
  CREATE TABLE IF NOT EXISTS rate_limits (
    ip_address TEXT PRIMARY KEY,
    requests TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log("[API] Rate limiting table initialized");

export async function POST(request: Request) {
  try {
    // Get IP address from headers
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown-ip";
    console.log(`[API] Request from IP: ${ip}`);

    // Check rate limit
    const now = Date.now();
    let userRequests: number[] = [];

    // Get rate limit data from database
    console.log(`[API] Checking rate limit for IP: ${ip}`);
    const rateLimitRow = db
      .prepare(
        "SELECT requests, updated_at FROM rate_limits WHERE ip_address = ?"
      )
      .get(ip) as RateLimitRow | undefined;

    if (rateLimitRow) {
      userRequests = JSON.parse(rateLimitRow.requests);
      console.log(
        `[API] Found ${userRequests.length} previous requests for IP: ${ip}`
      );

      // Update last updated timestamp
      db.prepare(
        "UPDATE rate_limits SET updated_at = CURRENT_TIMESTAMP WHERE ip_address = ?"
      ).run(ip);
    }

    // Filter out requests older than the rate limit window
    const recentRequests = userRequests.filter(
      (timestamp: number) => now - timestamp < RATE_LIMIT_WINDOW
    );
    console.log(`[API] ${recentRequests.length} recent requests for IP: ${ip}`);

    // Check if user has exceeded rate limit
    if (recentRequests.length >= MAX_REQUESTS_PER_HOUR) {
      console.log(`[API] Rate limit exceeded for IP: ${ip}`);
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Update rate limit tracking in database
    const updatedRequests = [...recentRequests, now];
    console.log(
      `[API] Updating rate limit for IP: ${ip} with ${updatedRequests.length} requests`
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
    console.log(
      `[API] Received request with prompt: ${prompt.substring(0, 50)}...`
    );

    if (!prompt) {
      console.log("[API] Error: No prompt provided");
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Extract CEFR level and language from the prompt for better caching
    const cefrLevelMatch = prompt.match(/CEFR level (A1|A2|B1|B2|C1|C2)/);
    const languageMatch = prompt.match(/paragraph in ([A-Za-z]+)/);

    const cefrLevel = cefrLevelMatch ? cefrLevelMatch[1] : "unknown";
    const language = languageMatch ? languageMatch[1] : "unknown";
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
      .get(language, cefrLevel, seed % 100 || 0) as
      | GeneratedContentRow
      | undefined;

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
    console.log("[API] Initializing OpenAI client");
    const openai = getOpenAIClient();

    console.log("[API] Sending request to OpenAI");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            'You are a helpful language tutor for a reading comprehension game. Create content based on the language and CEFR level specified in the user prompt.\n\nThe user will specify a language (like English, Italian, Spanish, etc.) and a CEFR level (A1-C2).\n\nFollow these guidelines for different CEFR levels:\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\n\nIMPORTANT FORMATTING INSTRUCTIONS:\n1. Generate the paragraph in the language requested by the user (e.g., Italian, Spanish, etc.)\n2. Generate the question and all answers in ENGLISH, regardless of the paragraph language\n\nCreate direct, clear comprehension questions that:\n- Have one unmistakably correct answer that comes directly from the text\n- Test simple comprehension rather than inference or interpretation\n- Focus on key details from the paragraph\n- Have plausible but clearly incorrect distractors\n\nCreate content in the following format ONLY:\n\n1. A paragraph in the requested language on an interesting topic appropriate for the requested CEFR level\n2. A multiple choice question IN ENGLISH that tests direct comprehension of the paragraph\n3. Four possible answers IN ENGLISH labeled A, B, C, and D\n4. The correct answer letter\n5. A short topic description for image generation (3-5 words in English)\n6. For each option, provide a brief explanation IN ENGLISH of why it is correct or incorrect\n7. Include the exact text from the paragraph (a quote in the original language) that supports the correct answer\n\nFormat your response exactly like this (including the JSON format):\n```json\n{\n  "paragraph": "your paragraph text here in the requested language",\n  "question": "your question about the paragraph here IN ENGLISH",\n  "options": {\n    "A": "first option IN ENGLISH",\n    "B": "second option IN ENGLISH",\n    "C": "third option IN ENGLISH",\n    "D": "fourth option IN ENGLISH"\n  },\n  "explanations": {\n    "A": "Explanation of why A is correct/incorrect IN ENGLISH",\n    "B": "Explanation of why B is correct/incorrect IN ENGLISH",\n    "C": "Explanation of why C is correct/incorrect IN ENGLISH",\n    "D": "Explanation of why D is correct/incorrect IN ENGLISH"\n  },\n  "correctAnswer": "B",\n  "relevantText": "Exact quote from the paragraph that supports the correct answer in the original language",\n  "topic": "brief topic for image IN ENGLISH"\n}\n```\n\nEXAMPLES:\n\nExample for Italian (B1 level):\n```json\n{\n  "paragraph": "Milano è una città famosa per la moda e il design. Ogni anno, migliaia di visitatori vengono per vedere le nuove collezioni. Il Duomo è il monumento più conosciuto della città. La gente può salire sul tetto per ammirare il panorama.",\n  "question": "Why do thousands of visitors come to Milan every year?",\n  "options": {\n    "A": "To visit the Duomo cathedral",\n    "B": "To see new fashion collections",\n    "C": "To admire the view from rooftops",\n    "D": "To study design at universities"\n  },\n  "explanations": {\n    "A": "Incorrect. While the Duomo is mentioned as the most famous monument, it\'s not stated as the reason thousands visit.",\n    "B": "Correct. The paragraph states that thousands of visitors come to see the new collections.",\n    "C": "Incorrect. While people can climb the Duomo to see the view, this is not mentioned as why thousands visit annually.",\n    "D": "Incorrect. Universities are not mentioned in the paragraph."\n  },\n  "correctAnswer": "B",\n  "relevantText": "Ogni anno, migliaia di visitatori vengono per vedere le nuove collezioni.",\n  "topic": "Milan fashion"\n}\n```\n\nVary the topics and ensure the correct answer isn\'t always the same letter. Make the question challenging but clearly answerable from the paragraph. Keep language appropriate for the specified CEFR level.',
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
    });

    const result = completion.choices[0].message.content;
    console.log("[API] Received response from OpenAI");

    // Store the result in database
    console.log(
      `[API] Storing generated content in database for language: ${language}, level: ${cefrLevel}`
    );
    db.prepare(
      `
      INSERT INTO generated_content (language, level, content, questions, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `
    ).run(language, cefrLevel, result, JSON.stringify({ prompt }));

    // Track usage statistics
    console.log(
      `[API] Recording usage statistics for language: ${language}, level: ${cefrLevel}`
    );
    db.prepare(
      `
      INSERT INTO usage_stats (ip_address, language, level)
      VALUES (?, ?, ?)
    `
    ).run(ip, language, cefrLevel);

    console.log("[API] Request completed successfully");
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[API] Error in chat API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
