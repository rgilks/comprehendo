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
    const { prompt, level = "B1" } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Initialize OpenAI only when the route is called
    const openai = getOpenAIClient();

    let promptComplexity = "suitable for intermediate English learners";

    // Adjust image complexity based on CEFR level
    if (level === "A1" || level === "A2") {
      promptComplexity = "simple, clear, and easy to understand for beginners";
    } else if (level === "B1" || level === "B2") {
      promptComplexity = "appropriate for intermediate English learners";
    } else if (level === "C1" || level === "C2") {
      promptComplexity =
        "sophisticated and detailed for advanced English learners";
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a clear, educational image that relates to this topic: ${prompt}. Make it ${promptComplexity}. Ensure the image is visually engaging but not overly complex.`,
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
