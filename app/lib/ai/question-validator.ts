import { ExerciseContent } from 'app/domain/schemas';
import { CEFRLevel } from 'app/domain/language-guidance';

export interface QualityMetrics {
  questionLength: number;
  explanationLength: number;
  optionsLength: number[];
  relevantTextLength: number;
  hasCorrectAnswer: boolean;
  allExplanationsPresent: boolean;
  relevantTextInParagraph: boolean;
  // Add more metrics as needed
}

export interface ValidationResult {
  isValid: boolean;
  reason: string;
  metrics: QualityMetrics;
}

const MIN_QUESTION_LENGTH = 10;
const MIN_EXPLANATION_LENGTH = 20;
const MIN_OPTION_LENGTH = 3;

export const validateQuestionQuality = (
  exercise: ExerciseContent,
  _level: CEFRLevel
): ValidationResult => {
  const metrics: QualityMetrics = {
    questionLength: exercise.question.length,
    explanationLength: Object.values(exercise.allExplanations).reduce(
      (sum, exp) => sum + exp.length,
      0
    ),
    optionsLength: Object.values(exercise.options).map((opt) => opt.length),
    relevantTextLength: exercise.relevantText.length,
    hasCorrectAnswer:
      !!exercise.correctAnswer && ['A', 'B', 'C', 'D'].includes(exercise.correctAnswer),
    allExplanationsPresent:
      Object.keys(exercise.allExplanations).length === 4 &&
      Object.values(exercise.allExplanations).every((exp) => exp.length > 0),
    relevantTextInParagraph: exercise.paragraph.includes(exercise.relevantText),
  };

  if (!metrics.hasCorrectAnswer) {
    return { isValid: false, reason: 'No valid correct answer specified.', metrics };
  }
  if (!metrics.allExplanationsPresent) {
    return { isValid: false, reason: 'Not all explanations are present or are empty.', metrics };
  }
  if (!metrics.relevantTextInParagraph) {
    return { isValid: false, reason: 'Relevant text is not found in the paragraph.', metrics };
  }
  if (metrics.questionLength < MIN_QUESTION_LENGTH) {
    return {
      isValid: false,
      reason: `Question is too short (${metrics.questionLength} chars).`,
      metrics,
    };
  }
  if (metrics.explanationLength < MIN_EXPLANATION_LENGTH * 4) {
    // At least MIN_EXPLANATION_LENGTH per explanation
    return {
      isValid: false,
      reason: `Explanations are too short (${metrics.explanationLength} total chars).`,
      metrics,
    };
  }
  if (metrics.optionsLength.some((len) => len < MIN_OPTION_LENGTH)) {
    return { isValid: false, reason: 'One or more options are too short.', metrics };
  }

  // Add more sophisticated checks based on CEFR level if needed
  // For example, checking vocabulary complexity, sentence structure complexity, etc.
  // This would likely require external NLP libraries or more advanced AI calls.

  return { isValid: true, reason: 'Question quality passed validation.', metrics };
};

export const logQualityMetrics = (metrics: QualityMetrics, level: CEFRLevel, language: string) => {
  console.log(`[QualityMetrics] Level: ${level}, Language: ${language}`);
  console.log(`  Question Length: ${metrics.questionLength}`);
  console.log(`  Total Explanation Length: ${metrics.explanationLength}`);
  console.log(`  Option Lengths: ${metrics.optionsLength.join(', ')}`);
  console.log(`  Relevant Text Length: ${metrics.relevantTextLength}`);
  console.log(`  Has Correct Answer: ${metrics.hasCorrectAnswer}`);
  console.log(`  All Explanations Present: ${metrics.allExplanationsPresent}`);
  console.log(`  Relevant Text In Paragraph: ${metrics.relevantTextInParagraph}`);
};
