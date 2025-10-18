import { describe, it, expect } from 'vitest';
import {
  calculateQuizState,
  shouldShowFeedbackPrompt,
  shouldShowFeedbackLoading,
  shouldOfferGeneration,
  type QuizInteractionParams,
} from 'app/lib/utils/quiz';

describe('quiz utils', () => {
  describe('calculateQuizState', () => {
    it('should reset showCorrectAnswer when not answered', () => {
      const params: QuizInteractionParams = {
        isAnswered: false,
        quizData: { id: 1 },
        showCorrectAnswer: true,
        questionsAnswered: 0,
      };

      const result = calculateQuizState(params);

      expect(result.showCorrectAnswer).toBe(false);
    });

    it('should increment questionsAnswered when answered', () => {
      const params: QuizInteractionParams = {
        isAnswered: true,
        quizData: { id: 1 },
        showCorrectAnswer: false,
        questionsAnswered: 2,
      };

      const result = calculateQuizState(params);

      expect(result.questionsAnswered).toBe(3);
    });

    it('should hide hint after 3 questions', () => {
      const params: QuizInteractionParams = {
        isAnswered: true,
        quizData: { id: 1 },
        showCorrectAnswer: false,
        questionsAnswered: 3,
      };

      const result = calculateQuizState(params);

      expect(result.showHint).toBe(false);
    });

    it('should reset showCorrectAnswer for new quiz', () => {
      const params: QuizInteractionParams = {
        isAnswered: false,
        quizData: { id: 2 },
        showCorrectAnswer: true,
        questionsAnswered: 5,
      };

      const result = calculateQuizState(params);

      expect(result.showCorrectAnswer).toBe(false);
    });
  });

  describe('shouldShowFeedbackPrompt', () => {
    it('should show prompt when conditions are met', () => {
      const result = shouldShowFeedbackPrompt(true, false, false, false, true);
      expect(result).toBe(true);
    });

    it('should not show prompt when not answered', () => {
      const result = shouldShowFeedbackPrompt(false, false, false, false, true);
      expect(result).toBe(false);
    });

    it('should not show prompt when feedback already submitted', () => {
      const result = shouldShowFeedbackPrompt(true, true, false, false, true);
      expect(result).toBe(false);
    });

    it('should not show prompt when loading', () => {
      const result = shouldShowFeedbackPrompt(true, false, true, false, true);
      expect(result).toBe(false);
    });

    it('should not show prompt when submitting feedback', () => {
      const result = shouldShowFeedbackPrompt(true, false, false, true, true);
      expect(result).toBe(false);
    });

    it('should not show prompt when not authenticated', () => {
      const result = shouldShowFeedbackPrompt(true, false, false, false, false);
      expect(result).toBe(false);
    });
  });

  describe('shouldShowFeedbackLoading', () => {
    it('should show loading when submitting feedback', () => {
      const result = shouldShowFeedbackLoading(true, false, false, true, true);
      expect(result).toBe(true);
    });

    it('should show loading when general loading', () => {
      const result = shouldShowFeedbackLoading(true, false, true, false, true);
      expect(result).toBe(true);
    });

    it('should not show loading when not answered', () => {
      const result = shouldShowFeedbackLoading(false, false, true, true, true);
      expect(result).toBe(false);
    });

    it('should not show loading when feedback submitted', () => {
      const result = shouldShowFeedbackLoading(true, true, true, true, true);
      expect(result).toBe(false);
    });
  });

  describe('shouldOfferGeneration', () => {
    it('should offer generation when no quiz data', () => {
      const result = shouldOfferGeneration(null, false, false, true);
      expect(result).toBe(true);
    });

    it('should offer generation when answered and feedback submitted', () => {
      const result = shouldOfferGeneration({ id: 1 }, true, true, true);
      expect(result).toBe(true);
    });

    it('should offer generation when answered but not authenticated', () => {
      const result = shouldOfferGeneration({ id: 1 }, true, false, false);
      expect(result).toBe(true);
    });

    it('should not offer generation when quiz exists and not answered', () => {
      const result = shouldOfferGeneration({ id: 1 }, false, false, true);
      expect(result).toBe(false);
    });

    it('should not offer generation when answered but feedback not submitted and authenticated', () => {
      const result = shouldOfferGeneration({ id: 1 }, true, false, true);
      expect(result).toBe(false);
    });
  });
});
