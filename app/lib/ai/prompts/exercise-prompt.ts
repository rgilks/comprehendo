import type { ExerciseGenerationParams } from 'app/domain/ai';
import type { CEFRLevel } from 'app/domain/language-guidance';

// Level-specific exemplars to guide AI generation
const getLevelExemplars = (level: CEFRLevel): string => {
  const exemplars: Record<CEFRLevel, string> = {
    A1: `
GOOD A1 EXAMPLE:
Paragraph: "My name is Anna. I am ten years old. I live in a small house with my mother and father. We have a cat. The cat is white."
Question: "Where does Anna live?"
Why GOOD: Direct, simple question requiring specific information from the text. Cannot be answered without reading.

BAD A1 EXAMPLE:
Question: "Do most children live with their parents?"
Why BAD: Answerable with general knowledge, not specific to the text.`,

    A2: `
GOOD A2 EXAMPLE:
Paragraph: "Last weekend, I went to the beach with my family. We arrived early in the morning. The weather was sunny and warm. I played in the water while my brother built a sandcastle."
Question: "What was the weather like when the family went to the beach?"
Why GOOD: Requires reading specific details from the passage.

BAD A2 EXAMPLE:
Question: "Is the beach usually a fun place?"
Why BAD: Based on general opinion, not passage content.`,

    B1: `
GOOD B1 EXAMPLE:
Paragraph: "Despite the rain, Maria decided to continue her morning jog. She had been training for the upcoming marathon for three months and didn't want to break her routine. As she ran through the park, she noticed fewer people than usual."
Question: "Why did Maria go jogging even though it was raining?"
Why GOOD: Requires inference from the text (dedication to training routine).

BAD B1 EXAMPLE:
Question: "Is jogging good exercise?"
Why BAD: General knowledge question, not passage-specific.`,

    B2: `
GOOD B2 EXAMPLE:
Paragraph: "The company's decision to implement remote work policies was met with mixed reactions. While younger employees praised the flexibility, senior staff expressed concerns about team cohesion and productivity monitoring."
Question: "How did different age groups respond to the remote work policy?"
Why GOOD: Requires understanding contrasting viewpoints presented in the text.

BAD B2 EXAMPLE:
Question: "Do companies benefit from remote work?"
Why BAD: General business question, not based on passage specifics.`,

    C1: `
GOOD C1 EXAMPLE:
Paragraph: "The paradigm shift in educational methodology reflects broader societal changes. Traditional didactic approaches are increasingly being supplanted by collaborative, student-centered learning environments that emphasize critical thinking over rote memorization."
Question: "What does the passage suggest about the relationship between educational changes and society?"
Why GOOD: Requires analysis and inference from complex text.

BAD C1 EXAMPLE:
Question: "Is modern education better than traditional education?"
Why BAD: Asks for value judgment not made in the passage.`,

    C2: `
GOOD C2 EXAMPLE:
Paragraph: "The juxtaposition of neoclassical economics with behavioral insights has engendered a more nuanced understanding of market anomalies. Traditional utility maximization models, while mathematically elegant, fail to account for the cognitive biases that pervade decision-making processes."
Question: "According to the passage, what limitation of neoclassical economics is addressed by behavioral insights?"
Why GOOD: Requires deep comprehension of complex academic content.

BAD C2 EXAMPLE:
Question: "Are behavioral insights important in economics?"
Why BAD: Generic question not tied to specific passage content.`,
  };

  return exemplars[level] || '';
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

  const levelExemplars = getLevelExemplars(level);

  const prompt = `Generate a reading comprehension exercise based on the following parameters:
- Topic: ${topic}
- Passage Language: ${passageLangName} (${passageLanguage})
- Question Language: ${questionLangName} (${questionLanguage})
- CEFR Level: ${level}
- Grammar Guidance: ${grammarGuidance}
- Vocabulary Guidance: ${vocabularyGuidance}

${levelExemplars}

CRITICAL QUALITY STANDARDS:

1. PASSAGE REQUIREMENTS:
   - Create a paragraph (3-6 sentences for A1-A2, 4-7 sentences for B1-C2) in ${passageLanguage}
   - Strictly adhere to ${level} CEFR level grammar and vocabulary guidelines above
   - Focus on the topic "${topic}" with specific, concrete details
   - Include information that will form the basis for your question
   - Avoid culturally-specific references that require outside knowledge
   - Make the content interesting and authentic, not artificial or contrived

2. QUESTION TYPE SELECTION (choose ONE type):
   a) MAIN IDEA: "What is the main topic/purpose of this passage?"
   b) SPECIFIC DETAIL: "According to the passage, when/where/who/what/how...?"
   c) INFERENCE: "What can we infer/conclude about...?" (must be clearly implied in text)
   d) VOCABULARY IN CONTEXT: "What does [word/phrase] mean as used in the passage?"

3. QUESTION REQUIREMENTS:
   - Write ONE clear question in ${questionLanguage} appropriate for ${level} learners
   - **CRITICAL:** The question MUST be IMPOSSIBLE to answer without reading the passage
   - Test this by asking: "Could someone answer this correctly using only general knowledge?" If yes, REJECT the question and create a new one
   - The answer must depend on SPECIFIC details, facts, or implications from the paragraph
   - Avoid questions about universal truths, common opinions, or general knowledge

4. DISTRACTOR (WRONG ANSWER) REQUIREMENTS:
   - Create three plausible but CLEARLY INCORRECT options (B, C, D)
   - Each distractor must be wrong because it:
     * Contradicts specific information in the passage, OR
     * Addresses a detail not mentioned in the passage, OR
     * Misinterprets information that IS in the passage
   - Make distractors tempting but definitively wrong based on the text
   - Avoid completely implausible or random options
   - Do NOT create distractors that could be true based on general knowledge but aren't supported by the passage

5. CORRECT ANSWER REQUIREMENTS:
   - Must be directly supported by or clearly inferable from the passage
   - Include in your "relevantText" the EXACT sentence/phrase that proves this answer is correct
   - The connection between question and answer should be unambiguous

6. EXPLANATION REQUIREMENTS:
   - Provide explanations for ALL four options (A, B, C, D) in ${questionLanguage}
   - For the CORRECT answer: Explain why it's right AND quote/reference the supporting text
   - For INCORRECT answers: Explain specifically why each contradicts or lacks support from the passage
   - Use phrases like "The passage states..." or "According to the text..." or "The passage does not mention..."
   - Make explanations pedagogical and helpful for learning

7. SELF-VALIDATION CHECKLIST (verify before submitting):
   ✓ Can this question be answered WITHOUT reading the passage? → If YES, revise question
   ✓ Does the passage contain the specific information needed to answer? → Must be YES
   ✓ Are all distractors wrong based on the passage content? → Must be YES
   ✓ Is the correct answer unambiguously supported by the text? → Must be YES
   ✓ Do the grammar and vocabulary match ${level} level? → Must be YES
   ✓ Are cultural/outside knowledge references avoided? → Must be YES

Output Format: Respond ONLY with a valid JSON object containing the following keys:
- "paragraph": (string) The generated paragraph in ${passageLanguage}
- "topic": (string) The topic used: "${topic}"
- "question": (string) The multiple-choice question in ${questionLanguage}
- "options": (object) An object with keys "A", "B", "C", "D", where each value is an answer option string in ${questionLanguage}
- "correctAnswer": (string) The key ("A", "B", "C", or "D") of the correct answer
- "allExplanations": (object) An object with keys "A", "B", "C", "D", where each value is the explanation string in ${questionLanguage}, explicitly referencing the text
- "relevantText": (string) The exact sentence or phrase from the paragraph in ${passageLanguage} that proves the correct answer

Example JSON structure:
{
  "paragraph": "...",
  "topic": "...",
  "question": "...",
  "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
  "correctAnswer": "B",
  "allExplanations": { 
    "A": "Incorrect. The passage states '...' which contradicts this option.",
    "B": "Correct. The passage explicitly states '...' which supports this answer.",
    "C": "Incorrect. While this seems plausible, the passage actually says '...' instead.",
    "D": "Incorrect. This is not mentioned anywhere in the passage."
  },
  "relevantText": "..."
}

Ensure the entire output is a single, valid JSON object string without any surrounding text or markdown formatting.
`;
  return prompt;
};
