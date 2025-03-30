import { OpenAI } from 'openai';
import { NextResponse } from 'next/server';

// Define interface for the expected request body structure
interface ImageRequestBody {
  prompt: string;
  level?: string; // level is optional
}

// Explicitly type the return value
const getOpenAIClient = (): OpenAI => {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
};

export async function POST(request: Request) {
  try {
    // Use the interface for the request body
    const body: ImageRequestBody = await request.json();
    // Assign default after validation/typing
    const { prompt } = body;
    const level = body.level ?? 'B1'; // Default level if not provided

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Initialize OpenAI only when the route is called
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const clientResult: unknown = getOpenAIClient();

    // Type guard for the OpenAI client
    if (!(clientResult instanceof OpenAI)) {
      console.error('Failed to initialize OpenAI client correctly.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const openai: OpenAI = clientResult;

    let promptComplexity = 'suitable for intermediate English learners';

    // Adjust image complexity based on CEFR level
    if (level === 'A1' || level === 'A2') {
      promptComplexity = 'simple, clear, and easy to understand for beginners';
    } else if (level === 'B1' || level === 'B2') {
      promptComplexity = 'appropriate for intermediate English learners';
    } else if (level === 'C1' || level === 'C2') {
      promptComplexity = 'sophisticated and detailed for advanced English learners';
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create a clear, educational image that relates to this topic: ${prompt}. Make it ${promptComplexity}. Ensure the image is visually engaging but not overly complex.`,
      n: 1,
      size: '1024x1024',
    });

    return NextResponse.json({ imageUrl: response.data[0].url });
  } catch (error) {
    console.error('Error in image API:', error);
    return NextResponse.json(
      { error: 'An error occurred while generating the image' },
      { status: 500 }
    );
  }
}
