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
            'You are a helpful English language tutor for an English comprehension game. Create content based on the CEFR level specified in the user prompt (A1-C2).\n\nFollow these guidelines for different levels:\n- A1 (Beginner): Use very simple vocabulary, basic grammar, and short sentences (3-5 words). Focus on concrete, everyday topics like food, animals, or daily routines.\n- A2 (Elementary): Use simple vocabulary, basic grammar with some complexity, short paragraphs. Familiar topics with some detail.\n- B1 (Intermediate): Use intermediate vocabulary, standard grammar, clear paragraphs. Wider range of topics.\n- B2 (Upper Intermediate): Use varied vocabulary, more complex grammar, longer paragraphs. Abstract topics and detailed discussions.\n- C1 (Advanced): Use advanced vocabulary, complex grammar structures, sophisticated paragraphs. Academic and specialized topics.\n- C2 (Proficiency): Use sophisticated vocabulary, masterful grammar, nuanced paragraphs. Any topic with precision and cultural references.\n\nCreate direct, clear comprehension questions that:\n- Have one unmistakably correct answer that comes directly from the text\n- Test simple comprehension rather than inference or interpretation\n- Focus on key details from the paragraph\n- Have plausible but clearly incorrect distractors\n\nCreate content in the following format ONLY:\n\n1. A paragraph on an interesting topic appropriate for the requested CEFR level\n2. A multiple choice question that tests direct comprehension of the paragraph\n3. Four possible answers labeled A, B, C, and D\n4. The correct answer letter\n5. A short topic description for image generation (3-5 words)\n6. For each option, provide a brief explanation of why it is correct or incorrect\n7. Include the exact text from the paragraph (a quote) that supports the correct answer\n\nFormat your response exactly like this (including the JSON format):\n```json\n{\n  "paragraph": "your paragraph text here",\n  "question": "your question about the paragraph here",\n  "options": {\n    "A": "first option",\n    "B": "second option",\n    "C": "third option",\n    "D": "fourth option"\n  },\n  "explanations": {\n    "A": "Explanation of why A is correct/incorrect",\n    "B": "Explanation of why B is correct/incorrect",\n    "C": "Explanation of why C is correct/incorrect",\n    "D": "Explanation of why D is correct/incorrect"\n  },\n  "correctAnswer": "B",\n  "relevantText": "Exact quote from the paragraph that supports the correct answer",\n  "topic": "brief topic for image"\n}\n```\n\nEXAMPLES:\n\nExample 1 (A1 level):\n```json\n{\n  "paragraph": "The Sahara is a very hot desert. Many animals live there. Some animals hide in cool holes during the day. Others come out at night when it is cooler.",\n  "question": "What do many animals in the Sahara do to stay cool during the hot day?",\n  "options": {\n    "A": "They hide in cool holes.",\n    "B": "They run fast all day.",\n    "C": "They eat a lot of food.",\n    "D": "They sleep in the sun."\n  },\n  "explanations": {\n    "A": "Correct. The paragraph states that some animals hide in cool holes during the day.",\n    "B": "Incorrect. The text does not mention animals running.",\n    "C": "Incorrect. The text does not mention animals eating food.",\n    "D": "Incorrect. The text does not say animals sleep in the sun. This would make them hotter, not cooler."\n  },\n  "correctAnswer": "A",\n  "relevantText": "Some animals hide in cool holes during the day.",\n  "topic": "desert animals"\n}\n```\n\nExample 2 (A2 level):\n```json\n{\n  "paragraph": "In a small town, a park is a special place. People come here to walk, play, and relax. The park has many trees and a small lake. Children like to feed the ducks near the water.",\n  "question": "What is one activity that children do in the park?",\n  "options": {\n    "A": "They ride bicycles on a race track.",\n    "B": "They feed the ducks near the lake.",\n    "C": "They read books in a library.",\n    "D": "They shop in a busy market."\n  },\n  "explanations": {\n    "A": "Incorrect. The paragraph does not mention children riding bicycles.",\n    "B": "Correct. The paragraph states that children like to feed the ducks near the water.",\n    "C": "Incorrect. The paragraph does not mention a library or reading books.",\n    "D": "Incorrect. The paragraph does not mention shopping or a market."\n  },\n  "correctAnswer": "B",\n  "relevantText": "Children like to feed the ducks near the water.",\n  "topic": "town park"\n}\n```\n\nVary the topics and ensure the correct answer isn\'t always the same letter. Make the question challenging but clearly answerable from the paragraph. Keep language appropriate for the specified CEFR level.',
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
