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
            'You are a helpful English language tutor for an English comprehension game. Create content in the following format ONLY:\n\n1. A paragraph (8-10 sentences) on an interesting topic\n2. A multiple choice question that tests comprehension of the paragraph\n3. Four possible answers labeled A, B, C, and D\n4. The correct answer letter\n5. A short topic description for image generation (3-5 words)\n\nFormat your response exactly like this (including the JSON format):\n```json\n{\n  "paragraph": "your paragraph text here",\n  "question": "your question about the paragraph here",\n  "options": {\n    "A": "first option",\n    "B": "second option",\n    "C": "third option",\n    "D": "fourth option"\n  },\n  "correctAnswer": "B",\n  "topic": "brief topic for image"\n}\n```\n\nVary the topics and ensure the correct answer isn\'t always the same letter. Make the question challenging but answerable from the paragraph.',
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
