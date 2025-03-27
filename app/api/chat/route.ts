import { OpenAI } from "openai";
import { NextResponse } from "next/server";

// Don't initialize OpenAI at build time
const getOpenAIClient = () => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Initialize OpenAI only when the route is called
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            'You are a helpful English language tutor for an English comprehension game. Create content based on the CEFR level specified in the user prompt (A1-C2).\n\nFollow these guidelines for different levels:\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences. Focus on everyday topics.\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\n\nCreate content in the following format ONLY:\n\n1. A paragraph (8-10 sentences) on an interesting topic appropriate for the requested CEFR level\n2. A multiple choice question that tests comprehension of the paragraph, matching the difficulty of the specified CEFR level\n3. Four possible answers labeled A, B, C, and D\n4. The correct answer letter\n5. A short topic description for image generation (3-5 words)\n\nFormat your response exactly like this (including the JSON format):\n```json\n{\n  "paragraph": "your paragraph text here",\n  "question": "your question about the paragraph here",\n  "options": {\n    "A": "first option",\n    "B": "second option",\n    "C": "third option",\n    "D": "fourth option"\n  },\n  "correctAnswer": "B",\n  "topic": "brief topic for image"\n}\n```\n\nVary the topics and ensure the correct answer isn\'t always the same letter. Make the question challenging but answerable from the paragraph.',
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
    });

    return NextResponse.json({ result: completion.choices[0].message.content });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
