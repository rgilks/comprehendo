import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callGoogleAI, AIResponseProcessingError } from './exercise-generator';

const mockGenerateContent = vi.fn();
const mockGenAIInstance = {
  models: {
    generateContent: mockGenerateContent,
  },
};

vi.mock('@/lib/ai/client', () => ({
  getGoogleAIClient: vi.fn(() => mockGenAIInstance),
}));

const samplePrompt = `Generate a reading comprehension exercise based on the following parameters:
- Topic: Daily Routines
- Passage Language: French (fr)
- Question Language: English (en)
- CEFR Level: A2
- Grammar Guidance: Present tense verbs
- Vocabulary Guidance: Words related to daily activities

Instructions:
1. Create a short paragraph (3-6 sentences) in fr suitable for a A2 learner, focusing on the topic "Daily Routines".
2. Write ONE multiple-choice question in en. The question should target ONE of the following comprehension skills based on the paragraph: (a) main idea, (b) specific detail, (c) inference (requiring understanding information implied but not explicitly stated), OR (d) vocabulary in context (asking the meaning of a word/phrase as used in the paragraph).
3. Provide four answer options (A, B, C, D) in en. Only one option should be correct.
4. Create plausible distractors (incorrect options B, C, D): These should relate to the topic but be clearly contradicted, unsupported by the paragraph, or represent common misinterpretations based *only* on the text. Avoid options that are completely unrelated or rely on outside knowledge. **Ensure distractors are incorrect specifically because they contradict or are unsupported by the provided paragraph.**
5. **CRITICAL REQUIREMENT:** The question **must be impossible** to answer correctly *without* reading and understanding the provided paragraph. The answer **must depend solely** on the specific details or implications within the text. Avoid any questions solvable by general knowledge or common sense.
6. Identify the correct answer key (A, B, C, or D).
7. Provide **concise explanations** (in en) for **ALL options (A, B, C, D)**. For the correct answer, explain why it's right. For incorrect answers, explain specifically why they are wrong according to the text. Each explanation MUST explicitly reference the specific part of the paragraph that supports or contradicts the option.
8. Extract the specific sentence or phrase from the original paragraph (in fr) that provides the primary evidence for the correct answer ("relevantText").

Output Format: Respond ONLY with a valid JSON object containing the following keys:
- "paragraph": (string) The generated paragraph in fr.
- "topic": (string) The topic used: "Daily Routines".
- "question": (string) The multiple-choice question in en.
- "options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in en.
- "correctAnswer": (string) The key ("A", "B", "C", or "D") of the correct answer.
- "allExplanations": (object) An object with keys "A", "B", "C", "D", where each value is the concise explanation string in en for that option, explicitly referencing the text.
- "relevantText": (string) The sentence or phrase from the paragraph in fr that supports the correct answer.

Example JSON structure:
{
  "paragraph": "...",
  "topic": "...",
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." }
  "correctAnswer": "B",
  "allExplanations": { "A": "Explanation A referencing text...", "B": "Explanation B referencing text...", "C": "Explanation C referencing text...", "D": "Explanation D referencing text..." },
  "relevantText": "..."
}

Ensure the entire output is a single, valid JSON object string without any surrounding text or markdown formatting.
`;

describe('AI Exercise Generation - callGoogleAI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('callGoogleAI', () => {
    const mockApiResponseText = '{ "paragraph": "Bonjour.", "question": "Hello?" }';

    it('should call the AI API and return cleaned JSON content on success', async () => {
      const rawText = `\`\`\`json\n${mockApiResponseText}\n\`\`\``;
      mockGenerateContent.mockResolvedValue({ text: rawText });

      const result = await callGoogleAI(samplePrompt);

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash-preview-04-17',
        contents: [{ role: 'user', parts: [{ text: samplePrompt }] }],
        generationConfig: expect.objectContaining({
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        }),
      });
      expect(result).toBe(mockApiResponseText);
    });

    it('should correctly clean JSON content with optional newlines around fences', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: `\`\`\`json\n${mockApiResponseText}\`\`\``,
      });
      const result1 = await callGoogleAI(samplePrompt);
      expect(result1).toBe(mockApiResponseText);

      mockGenerateContent.mockResolvedValueOnce({
        text: `\`\`\`json${mockApiResponseText}\n\`\`\``,
      });
      const result2 = await callGoogleAI(samplePrompt);
      expect(result2).toBe(mockApiResponseText);

      mockGenerateContent.mockResolvedValueOnce({
        text: `\`\`\`json\n${mockApiResponseText}\n\`\`\``,
      });
      const result3 = await callGoogleAI(samplePrompt);
      expect(result3).toBe(mockApiResponseText);

      mockGenerateContent.mockResolvedValueOnce({ text: `\`\`\`json${mockApiResponseText}\`\`\`` });
      const result4 = await callGoogleAI(samplePrompt);
      expect(result4).toBe(mockApiResponseText);
    });

    it('should throw AIResponseProcessingError if AI response has no text', async () => {
      mockGenerateContent.mockResolvedValue({ text: null });

      await expect(callGoogleAI(samplePrompt)).rejects.toThrow(AIResponseProcessingError);
    });

    it('should throw specific AIResponseProcessingError for safety issues', async () => {
      const safetyError = new Error('Blocked due to SAFETY');
      mockGenerateContent.mockRejectedValue(safetyError);

      await expect(callGoogleAI(samplePrompt)).rejects.toThrow(AIResponseProcessingError);
      await expect(callGoogleAI(samplePrompt)).rejects.toThrow(/Safety setting blocked response:/);
    });

    it('should throw AIResponseProcessingError for generic API errors', async () => {
      const genericError = new Error('API connection failed');
      mockGenerateContent.mockRejectedValue(genericError);

      await expect(callGoogleAI(samplePrompt)).rejects.toThrow(AIResponseProcessingError);
      await expect(callGoogleAI(samplePrompt)).rejects.toThrow(/AI generation failed:/);
    });
  });
});
