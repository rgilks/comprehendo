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

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a clear, educational image that relates to this topic: ${prompt}. Make it suitable for English language students.`,
      n: 1,
      size: "1024x1024",
    });

    return NextResponse.json({ imageUrl: response.data[0].url });
  } catch (error) {
    console.error("Error in image API:", error);
    return NextResponse.json(
      { error: "An error occurred while generating the image" },
      { status: 500 }
    );
  }
}
