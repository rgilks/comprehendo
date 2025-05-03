import { GoogleGenAI } from '@google/genai';
import { getActiveModel, getGoogleAIClient } from '@/lib/modelConfig';
import type { Language } from '@/config/languages';
import type { CEFRLevel } from '@/config/language-guidance';
import type { ModelConfig } from '@/lib/modelConfig';
import { QuizDataSchema, type QuizData } from '@/lib/domain/schemas';

// Define interfaces for structured prompt parameters and AI response
// (Could potentially reuse/refine QuizDataSchema here if appropriate)
export interface ExerciseGenerationParams {
  topic: string;
  passageLanguage: Language;
  questionLanguage: Language;
  passageLangName: string;
  questionLangName: string;
  level: CEFRLevel;
  grammarGuidance: string;
  vocabularyGuidance: string;
}

// Export the error class
export class AIResponseProcessingError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AIResponseProcessingError';
  }
}

// Helper function for AI generation and validation
export const generateAndValidateExercise = async ({
  topic,
  passageLanguage,
  questionLanguage,
  passageLangName,
  questionLangName,
  level,
  grammarGuidance,
  vocabularyGuidance,
}: ExerciseGenerationParams): Promise<QuizData> => {
  const activeModel = getActiveModel();

  const prompt = generateExercisePrompt({
    topic,
    passageLanguage,
    questionLanguage,
    passageLangName,
    questionLangName,
    level,
    grammarGuidance,
    vocabularyGuidance,
  });

  const cleanedAiResponseContent = await callGoogleAI(prompt, activeModel);

  let parsedAiContent: unknown;
  try {
    parsedAiContent = JSON.parse(cleanedAiResponseContent);
  } catch (parseError: unknown) {
    console.error(
      '[AI:generateAndValidateExercise] Failed to parse AI response JSON:',
      parseError,
      '\nCleaned Response:\n',
      cleanedAiResponseContent
    );
    const errorToCapture = parseError instanceof Error ? parseError : new Error(String(parseError));
    throw new AIResponseProcessingError(
      `Failed to parse AI JSON response. Error: ${errorToCapture.message}`,
      errorToCapture // Pass original error
    );
  }

  const validationResult = QuizDataSchema.safeParse(parsedAiContent);
  if (!validationResult.success) {
    console.error(
      '[AI:generateAndValidateExercise] AI response failed Zod validation:',
      JSON.stringify(validationResult.error.format(), null, 2)
    );
    console.error(
      '[AI:generateAndValidateExercise] Failing AI Response Content:',
      cleanedAiResponseContent
    );
    throw new AIResponseProcessingError(
      `AI response failed validation. Errors: ${JSON.stringify(validationResult.error.format())}`
    );
  }
  return validationResult.data;
};

export const generateExercisePrompt = (params: ExerciseGenerationParams): string => {
  const {
    topic,
    passageLanguage,
    questionLanguage,
    passageLangName,
    questionLangName,
    level,
    grammarGuidance,
    vocabularyGuidance,
  } = params;

  // The prompt construction logic from app/actions/exercise.ts goes here
  const prompt = `Generate a reading comprehension exercise based on the following parameters:\n- Topic: ${topic}\n- Passage Language: ${passageLangName} (${passageLanguage})\n- Question Language: ${questionLangName} (${questionLanguage})\n- CEFR Level: ${level}\n- Grammar Guidance: ${grammarGuidance}\n- Vocabulary Guidance: ${vocabularyGuidance}\n\nInstructions:\n1. Create a short paragraph (3-6 sentences) in ${passageLanguage} suitable for a ${level} learner, focusing on the topic "${topic}".\n2. Write ONE multiple-choice question in ${questionLanguage}. The question should target ONE of the following comprehension skills based on the paragraph: (a) main idea, (b) specific detail, (c) inference (requiring understanding information implied but not explicitly stated), OR (d) vocabulary in context (asking the meaning of a word/phrase as used in the paragraph).\n3. Provide four answer options (A, B, C, D) in ${questionLanguage}. Only one option should be correct.\n4. Create plausible distractors (incorrect options B, C, D): These should relate to the topic but be clearly contradicted, unsupported by the paragraph, or represent common misinterpretations based *only* on the text. Avoid options that are completely unrelated or rely on outside knowledge. **Ensure distractors are incorrect specifically because they contradict or are unsupported by the provided paragraph.**\n5. **CRITICAL REQUIREMENT:** The question **must be impossible** to answer correctly *without* reading and understanding the provided paragraph. The answer **must depend solely** on the specific details or implications within the text. Avoid any questions solvable by general knowledge or common sense.\n6. Identify the correct answer key (A, B, C, or D).\n7. Provide **concise explanations** (in ${questionLanguage}) for **ALL options (A, B, C, D)**. For the correct answer, explain why it's right. For incorrect answers, explain specifically why they are wrong according to the text. Each explanation MUST explicitly reference the specific part of the paragraph that supports or contradicts the option.\n8. Extract the specific sentence or phrase from the original paragraph (in ${passageLanguage}) that provides the primary evidence for the correct answer ("relevantText").\n\nOutput Format: Respond ONLY with a valid JSON object containing the following keys:\n- "paragraph": (string) The generated paragraph in ${passageLanguage}.\n- "topic": (string) The topic used: "${topic}".\n- "question": (string) The multiple-choice question in ${questionLanguage}.\n- "options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in ${questionLanguage}.\n- "correctAnswer": (string) The key ("A", "B", "C", or "D") of the correct answer.\n- "allExplanations": (object) An object with keys "A", "B", "C", "D", where each value is the concise explanation string in ${questionLanguage} for that option, explicitly referencing the text.\n- "relevantText": (string) The sentence or phrase from the paragraph in ${passageLanguage} that supports the correct answer.\n\nExample JSON structure:\n{
  "paragraph": "...",
  "topic": "...",
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": "B",
  "allExplanations": { "A": "Explanation A referencing text...", "B": "Explanation B referencing text...", "C": "Explanation C referencing text...", "D": "Explanation D referencing text..." },
  "relevantText": "..."
}

Ensure the entire output is a single, valid JSON object string without any surrounding text or markdown formatting.
`;
  return prompt;
};

export const callGoogleAI = async (prompt: string, modelConfig: ModelConfig): Promise<string> => {
  console.log('[AI Generator] Calling Google AI API...');
  const genAI: GoogleGenAI = getGoogleAIClient();

  const generationConfig = {
    maxOutputTokens: modelConfig.maxTokens,
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
    frequencyPenalty: 0.3,
    presencePenalty: 0.2,
    candidateCount: 1,
    responseMimeType: 'application/json',
  };

  try {
    const request = {
      model: modelConfig.name,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: generationConfig,
    };

    console.log('[AI Generator] Google AI full request:', JSON.stringify(request, null, 2)); // Log full request for context

    const result = await genAI.models.generateContent(request);

    console.log('[AI Generator] Google AI full result:', JSON.stringify(result, null, 2));

    const text: string | undefined = result.text;

    if (text === undefined) {
      console.error(
        '[AI Generator] Failed to extract text from Google AI response:',
        JSON.stringify(result, null, 2)
      );
      throw new AIResponseProcessingError(
        'No content received from Google AI or failed to extract text.'
      );
    }

    console.log('[AI Generator] Received response from Google AI.');
    // Clean up markdown fences (```json ... ```)
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const match = text.match(jsonRegex);
    let potentialJson: string;

    if (match && match[1]) {
      potentialJson = match[1].trim();
    } else {
      // If no fences, assume the whole text might be JSON
      const trimmedText = text.trim();
      if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
        potentialJson = trimmedText;
      } else {
        // If it doesn't look like JSON and wasn't in fences, throw an error.
        console.warn('[AI] Response received, but no JSON block found:', text);
        throw new AIResponseProcessingError(
          'AI response received, but failed to extract JSON content block.'
        );
      }
    }
    console.log('[AI Generator] Cleaned AI response:', potentialJson);
    return potentialJson;
  } catch (error: unknown) {
    // Use instanceof Error for type checking
    let errorMessage = 'Unknown AI generation error';
    if (error instanceof Error) {
      console.error('[AI] Google AI API call failed:', error.message, error.stack);
      errorMessage = error.message;
    } else {
      console.error('[AI] Google AI API call failed with non-Error object:', error);
    }

    // Check for specific error messages if possible (e.g., safety settings)
    if (errorMessage.includes('SAFETY')) {
      throw new AIResponseProcessingError(
        `Safety setting blocked response: ${errorMessage}`,
        error // Pass original error (unknown)
      );
    }
    // General error
    throw new AIResponseProcessingError(`AI generation failed: ${errorMessage}`, error); // Pass original error (unknown)
  }
};
