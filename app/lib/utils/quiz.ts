export interface QuizState {
  isAnswered: boolean;
  showCorrectAnswer: boolean;
  questionsAnswered: number;
  showHint: boolean;
}

export interface QuizInteractionParams {
  isAnswered: boolean;
  quizData: unknown;
  showCorrectAnswer: boolean;
  questionsAnswered: number;
}

export const calculateQuizState = (params: QuizInteractionParams): Partial<QuizState> => {
  const { isAnswered, quizData, showCorrectAnswer, questionsAnswered } = params;

  const updates: Partial<QuizState> = {};

  // Handle correct answer display timing
  if (isAnswered && !showCorrectAnswer) {
    // This would be handled by useEffect in component, but we can track the state
    updates.showCorrectAnswer = false; // Will be set to true after timeout
  } else if (!isAnswered) {
    updates.showCorrectAnswer = false;
  }

  // Track questions answered and hide hints after 3 questions
  if (isAnswered && !showCorrectAnswer) {
    updates.questionsAnswered = questionsAnswered + 1;
  }

  // Hide hints after 3 questions
  if (questionsAnswered >= 3) {
    updates.showHint = false;
  }

  // Reset hint state when new quiz loads
  if (quizData && !isAnswered) {
    updates.showCorrectAnswer = false;
  }

  return updates;
};

export const shouldShowFeedbackPrompt = (
  isAnswered: boolean,
  feedbackSubmitted: boolean,
  loading: boolean,
  isSubmittingFeedback: boolean,
  isAuthenticated: boolean
): boolean => {
  return isAnswered && !feedbackSubmitted && !loading && !isSubmittingFeedback && isAuthenticated;
};

export const shouldShowFeedbackLoading = (
  isAnswered: boolean,
  feedbackSubmitted: boolean,
  loading: boolean,
  isSubmittingFeedback: boolean,
  isAuthenticated: boolean
): boolean => {
  return isAnswered && !feedbackSubmitted && (loading || isSubmittingFeedback) && isAuthenticated;
};

export const shouldOfferGeneration = (
  quizData: unknown,
  isAnswered: boolean,
  feedbackSubmitted: boolean,
  isAuthenticated: boolean
): boolean => {
  return !quizData || (isAnswered && (feedbackSubmitted || !isAuthenticated));
};
