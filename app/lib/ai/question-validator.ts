import { ExerciseContent } from 'app/domain/schemas';
import { getComplexityMetrics, type CEFRLevel } from 'app/domain/language-guidance';

export interface QuestionQualityMetrics {
  passageReadability: number;
  questionClarity: number;
  distractorQuality: number;
  answerSupport: number;
  cefrCompliance: number;
  overallScore: number;
  issues: string[];
}

export interface ValidationResult {
  isValid: boolean;
  metrics: QuestionQualityMetrics;
  shouldRegenerate: boolean;
  reason?: string;
}

// Enhanced readability scoring based on complexity metrics
const calculateReadability = (text: string, level: CEFRLevel): number => {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  const avgSentenceLength = words.length / sentences.length;
  const complexityMetrics = getComplexityMetrics(level);

  // Check sentence length compliance
  let sentenceScore = 1.0;
  if (avgSentenceLength < complexityMetrics.sentence_length.min) {
    sentenceScore = 0.3; // Too simple
  } else if (avgSentenceLength > complexityMetrics.sentence_length.max) {
    sentenceScore = 0.3; // Too complex
  } else {
    // Calculate how close to target
    const distanceFromTarget = Math.abs(
      avgSentenceLength - complexityMetrics.sentence_length.target
    );
    const maxDistance = Math.max(
      complexityMetrics.sentence_length.target - complexityMetrics.sentence_length.min,
      complexityMetrics.sentence_length.max - complexityMetrics.sentence_length.target
    );
    sentenceScore = 1.0 - (distanceFromTarget / maxDistance) * 0.5;
  }

  // Check vocabulary complexity
  const complexWords = words.filter((word) => {
    const syllables = word.toLowerCase().replace(/[^aeiou]/g, '').length;
    return syllables > complexityMetrics.max_syllables_per_word;
  });
  const vocabularyComplexityRatio = complexWords.length / words.length;
  const vocabularyScore = Math.max(
    0,
    1.0 - Math.abs(vocabularyComplexityRatio - complexityMetrics.vocabulary_complexity) * 2
  );

  // Check grammar complexity (rough estimation based on sentence structure)
  const clauseCount = text.split(/[,;]/).length;
  const avgClausesPerSentence = clauseCount / sentences.length;
  const grammarScore =
    avgClausesPerSentence <= complexityMetrics.max_clauses_per_sentence ? 1.0 : 0.5;

  // Weighted average
  return sentenceScore * 0.5 + vocabularyScore * 0.3 + grammarScore * 0.2;
};

// Check if question can be answered without the passage
const checkQuestionDependency = (question: string, passage: string): boolean => {
  const questionLower = question.toLowerCase();

  // Common general knowledge question patterns
  const generalKnowledgePatterns = [
    /is.*good for/i,
    /should.*always/i,
    /do.*usually/i,
    /is.*better than/i,
    /do.*most people/i,
    /is.*important/i,
    /do.*generally/i,
    /is.*common/i,
    /do.*typically/i,
    /is.*normal/i,
  ];

  // Check if question asks for general knowledge
  for (const pattern of generalKnowledgePatterns) {
    if (pattern.test(questionLower)) {
      return false; // Likely answerable without passage
    }
  }

  // Check if question asks for specific details from passage
  const passageSpecificPatterns = [
    /according to the passage/i,
    /in the passage/i,
    /the passage states/i,
    /the text mentions/i,
    /what does.*mean in the passage/i,
    /what happened.*in the story/i,
    /where.*in the text/i,
    /when.*in the passage/i,
  ];

  for (const pattern of passageSpecificPatterns) {
    if (pattern.test(questionLower)) {
      return true; // Requires passage
    }
  }

  // If question contains specific details that appear in passage, it's likely passage-dependent
  const passageWords = passage.toLowerCase().split(/\s+/);
  const questionWords = questionLower.split(/\s+/);
  const commonWords = questionWords.filter(
    (word) => word.length > 3 && passageWords.includes(word)
  );

  return commonWords.length >= 2; // At least 2 significant words in common
};

// Validate distractor quality
const validateDistractors = (
  options: Record<string, string>,
  correctAnswer: string,
  passage: string
): number => {
  const incorrectOptions = Object.entries(options)
    .filter(([key]) => key !== correctAnswer)
    .map(([, value]) => value);

  let score = 0;

  // Check if distractors are plausible but wrong
  for (const distractor of incorrectOptions) {
    // Distractor should be related to the topic but wrong
    const distractorWords = distractor.toLowerCase().split(/\s+/);
    const passageWords = passage.toLowerCase().split(/\s+/);
    const commonWords = distractorWords.filter(
      (word) => word.length > 3 && passageWords.includes(word)
    );

    if (commonWords.length > 0) {
      score += 0.3; // Related to passage
    }

    // Distractor should not be obviously wrong
    if (distractor.length < 5 || distractor.length > 100) {
      score -= 0.2; // Too short or too long
    }
  }

  return Math.min(1, Math.max(0, score / incorrectOptions.length));
};

// Check if correct answer is well-supported by passage
const validateAnswerSupport = (
  correctAnswer: string,
  options: Record<string, string>,
  relevantText: string,
  passage: string
): number => {
  const correctOption = options[correctAnswer];

  if (!relevantText || relevantText.trim().length === 0) {
    return 0.2; // No supporting text provided
  }

  // Check if relevant text actually appears in passage
  const passageLower = passage.toLowerCase();
  const relevantLower = relevantText.toLowerCase();

  if (!passageLower.includes(relevantLower)) {
    return 0.3; // Relevant text not found in passage
  }

  // Check if correct answer is supported by relevant text
  const correctWords = correctOption.toLowerCase().split(/\s+/);
  const relevantWords = relevantLower.split(/\s+/);
  const supportingWords = correctWords.filter(
    (word) => word.length > 3 && relevantWords.includes(word)
  );

  if (supportingWords.length === 0) {
    return 0.4; // No clear connection
  }

  return 0.8; // Well supported
};

// Validate CEFR level compliance
const validateCefrCompliance = (content: ExerciseContent, level: CEFRLevel): number => {
  const fullText = `${content.paragraph} ${content.question} ${Object.values(content.options).join(' ')}`;
  const words = fullText.toLowerCase().split(/\s+/);

  let score = 0.5; // Start with neutral score

  // Check for overly complex vocabulary (for lower levels)
  if (level === 'A1' || level === 'A2') {
    const complexWords = words.filter(
      (word) =>
        word.length > 8 ||
        /[^a-záéíóúñü]/.test(word) || // Non-basic characters
        word.includes('-') || // Hyphenated words
        word.includes('_') // Underscores
    );

    if (complexWords.length / words.length > 0.1) {
      score -= 0.3; // Too many complex words
    }
  }

  // Check sentence structure complexity
  const sentences = content.paragraph.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgLength = content.paragraph.split(/\s+/).length / sentences.length;

  if (level === 'A1' && avgLength > 10) score -= 0.2;
  if (level === 'A2' && avgLength > 15) score -= 0.2;
  if (level === 'B1' && avgLength > 20) score -= 0.2;

  return Math.max(0, Math.min(1, score));
};

// Main validation function
export const validateQuestionQuality = (
  content: ExerciseContent,
  level: CEFRLevel
): ValidationResult => {
  const issues: string[] = [];

  // Calculate individual metrics
  const passageReadability = calculateReadability(content.paragraph, level);
  const questionDependency = checkQuestionDependency(content.question, content.paragraph);
  const distractorQuality = validateDistractors(
    content.options,
    content.correctAnswer,
    content.paragraph
  );
  const answerSupport = validateAnswerSupport(
    content.correctAnswer,
    content.options,
    content.relevantText || '',
    content.paragraph
  );
  const cefrCompliance = validateCefrCompliance(content, level);

  // Check for critical issues
  if (!questionDependency) {
    issues.push('Question can be answered without reading the passage');
  }

  if (passageReadability < 0.4) {
    issues.push('Passage complexity does not match CEFR level');
  }

  if (distractorQuality < 0.3) {
    issues.push('Distractors are not plausible or well-crafted');
  }

  if (answerSupport < 0.5) {
    issues.push('Correct answer is not well-supported by the passage');
  }

  if (cefrCompliance < 0.4) {
    issues.push('Content does not match CEFR level requirements');
  }

  // Calculate overall score
  const overallScore =
    passageReadability * 0.2 +
    (questionDependency ? 0.3 : 0) +
    distractorQuality * 0.2 +
    answerSupport * 0.2 +
    cefrCompliance * 0.1;

  const metrics: QuestionQualityMetrics = {
    passageReadability,
    questionClarity: questionDependency ? 1 : 0,
    distractorQuality,
    answerSupport,
    cefrCompliance,
    overallScore,
    issues,
  };

  // Determine if regeneration is needed
  const shouldRegenerate = overallScore < 0.6 || issues.length > 2;

  return {
    isValid: !shouldRegenerate,
    metrics,
    shouldRegenerate,
    reason: shouldRegenerate
      ? `Quality score too low (${overallScore.toFixed(2)}) or too many issues (${issues.length})`
      : '',
  };
};

// Log quality metrics for monitoring
export const logQualityMetrics = (
  metrics: QuestionQualityMetrics,
  level: CEFRLevel,
  language: string
): void => {
  console.log(
    `[QuestionQuality] Level: ${level}, Language: ${language}, Score: ${metrics.overallScore.toFixed(2)}`
  );
  if (metrics.issues.length > 0) {
    console.log(`[QuestionQuality] Issues: ${metrics.issues.join(', ')}`);
  }
};
