import { describe, it, expect, vi } from 'vitest';
import {
  validateQuestionQuality,
  logQualityMetrics,
  debugValidationFailure,
} from 'app/lib/ai/question-validator';
import type { ExerciseContent } from 'app/domain/schemas';

describe('question validator', () => {
  const mockExercise: ExerciseContent = {
    question: 'What is the main topic of this passage?',
    options: {
      A: 'Option A with sufficient length',
      B: 'Option B with sufficient length',
      C: 'Option C with sufficient length',
      D: 'Option D with sufficient length',
    },
    correctAnswer: 'A',
    allExplanations: {
      A: 'This is the correct answer because the passage clearly states the main topic.',
      B: 'This is incorrect because the passage does not mention this topic.',
      C: 'This is incorrect because it contradicts the passage content.',
      D: 'This is incorrect because it is not supported by the passage.',
    },
    relevantText: 'the main topic discussed in this passage is clearly stated',
    paragraph:
      'This is a sample paragraph that contains the main topic discussed in this passage is clearly stated. It provides context and details about the subject matter.',
  };

  describe('validateQuestionQuality', () => {
    it('should validate a good quality question', () => {
      const result = validateQuestionQuality(mockExercise, 'B1');

      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('Question quality passed validation.');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.hasCorrectAnswer).toBe(true);
      expect(result.metrics.allExplanationsPresent).toBe(true);
      expect(result.metrics.relevantTextInParagraph).toBe(true);
    });

    it('should reject question with missing explanations', () => {
      const invalidExercise = {
        ...mockExercise,
        allExplanations: {
          A: 'Explanation A',
          B: 'Explanation B',
          // Missing C and D
        } as never,
      };

      const result = validateQuestionQuality(invalidExercise, 'B1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Not all explanations are present or are empty.');
    });

    it('should reject question with empty explanations', () => {
      const invalidExercise = {
        ...mockExercise,
        allExplanations: {
          A: 'Explanation A',
          B: 'Explanation B',
          C: '',
          D: '',
        },
      };

      const result = validateQuestionQuality(invalidExercise, 'B1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Not all explanations are present or are empty.');
    });

    it('should reject question when relevant text not in paragraph', () => {
      const invalidExercise = {
        ...mockExercise,
        relevantText: 'This text is not in the paragraph',
      };

      const result = validateQuestionQuality(invalidExercise, 'B1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Relevant text is not found in the paragraph.');
    });

    it('should reject question that is too short', () => {
      const invalidExercise = {
        ...mockExercise,
        question: 'What?',
        relevantText: 'the main topic discussed in this passage is clearly stated',
      };

      const result = validateQuestionQuality(invalidExercise, 'B1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Question is too short');
    });

    it('should reject question with short explanations', () => {
      const invalidExercise = {
        ...mockExercise,
        allExplanations: {
          A: 'Short',
          B: 'Short',
          C: 'Short',
          D: 'Short',
        },
        relevantText: 'the main topic discussed in this passage is clearly stated',
      };

      const result = validateQuestionQuality(invalidExercise, 'B1');

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Explanations are too short');
    });

    it('should log warnings for validation issues but still pass', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = validateQuestionQuality(mockExercise, 'B1');

      expect(result.isValid).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Validation]'));

      consoleSpy.mockRestore();
    });
  });

  describe('logQualityMetrics', () => {
    it('should log quality metrics', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const metrics = {
        questionLength: 10,
        explanationLength: 100,
        optionsLength: [10, 10, 10, 10],
        relevantTextLength: 20,
        hasCorrectAnswer: true,
        allExplanationsPresent: true,
        relevantTextInParagraph: true,
        answerConsistency: true,
        explanationConsistency: true,
        questionAnswerCoherence: true,
        semanticAnswerValidation: true,
      };

      logQualityMetrics(metrics, 'B1', 'en');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[QualityMetrics]'));

      consoleSpy.mockRestore();
    });
  });

  describe('debugValidationFailure', () => {
    it('should log debug information for validation failure', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      debugValidationFailure(mockExercise, 'Test failure reason');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ValidationDebug]'));

      consoleSpy.mockRestore();
    });
  });
});
