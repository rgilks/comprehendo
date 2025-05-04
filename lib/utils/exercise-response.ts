export const DEFAULT_EMPTY_QUIZ_DATA = {
  paragraph: '',
  question: '',
  options: { A: '', B: '', C: '', D: '' },
  language: null,
  topic: null,
};

export const createErrorResponse = (error: string) => ({
  quizData: DEFAULT_EMPTY_QUIZ_DATA,
  quizId: -1,
  error,
  cached: false,
});
