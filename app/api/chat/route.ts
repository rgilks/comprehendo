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
            "You are a helpful English language tutor for an English comprehension game. Create varied, diverse content on different topics. Avoid repetition of themes or subjects. Focus on the specific topic requested and avoid mentioning unrelated topics.",
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
