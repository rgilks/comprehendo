import { render, screen, fireEvent } from '@testing-library/react';
import QuizSection from './QuizSection';

vi.mock('react-i18next', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-i18next')>();
  return {
    ...original,
    useTranslation: () => ({ t: (key: string) => key }),
    I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
  getTextDirection: () => 'ltr',
}));

const quizData = {
  question: 'What is the capital of France?',
  options: { A: 'Paris', B: 'London', C: 'Berlin', D: 'Madrid' },
  paragraph: 'Paris is the capital of France.',
  topic: 'Geography',
  language: 'en',
};

describe('QuizSection', () => {
  let store: any;
  beforeEach(async () => {
    store = {
      quizData,
      selectedAnswer: null,
      isAnswered: false,
      showExplanation: false,
      showQuestionSection: true,
      handleAnswerSelect: vi.fn(),
      feedbackIsCorrect: false,
      feedbackCorrectAnswer: 'A',
      feedbackCorrectExplanation: 'Paris is the correct answer.',
      feedbackChosenIncorrectExplanation: 'That is not correct.',
      generatedPassageLanguage: 'en',
    };
    const mod = await import('@/store/textGeneratorStore');
    vi.spyOn(mod, 'default').mockReturnValue(store);
  });

  it('renders question and options', () => {
    render(<QuizSection />);
    expect(screen.getByTestId('question-text')).toHaveTextContent(quizData.question);
    Object.values(quizData.options).forEach((option) => {
      expect(screen.getByText(option)).toBeInTheDocument();
    });
  });

  it('calls handleAnswerSelect when an option is clicked', () => {
    render(<QuizSection />);
    const btn = screen.getByTestId('answer-option-1');
    fireEvent.click(btn);
    expect(store.handleAnswerSelect).toHaveBeenCalled();
  });

  it('disables options when answered', () => {
    store.isAnswered = true;
    render(<QuizSection />);
    expect(screen.getByTestId('answer-option-0')).toBeDisabled();
  });

  it('shows correct explanation when answered and showExplanation', () => {
    store.isAnswered = true;
    store.showExplanation = true;
    render(<QuizSection />);
    expect(screen.getByTestId('feedback-explanation')).toBeInTheDocument();
    expect(screen.getByTestId('correct-explanation-text')).toHaveTextContent(
      'Paris is the correct answer.'
    );
  });

  it('shows relevant text when correct', () => {
    store.isAnswered = true;
    store.showExplanation = true;
    store.feedbackIsCorrect = true;
    render(<QuizSection />);
    expect(screen.getByTestId('relevant-text')).toBeInTheDocument();
    expect(screen.getByTestId('relevant-text')).toHaveTextContent('Paris');
  });

  it('shows next button when correct', () => {
    store.isAnswered = true;
    store.showExplanation = true;
    store.feedbackIsCorrect = true;
    render(<QuizSection />);
    expect(screen.getByTestId('next-exercise-button')).toBeInTheDocument();
  });

  it('shows chosen incorrect explanation when incorrect', () => {
    store.isAnswered = true;
    store.showExplanation = true;
    store.feedbackIsCorrect = false;
    store.selectedAnswer = 'B';
    render(<QuizSection />);
    expect(screen.getByTestId('chosen-incorrect-explanation-text')).toBeInTheDocument();
    expect(screen.getByTestId('chosen-incorrect-explanation-text')).toHaveTextContent(
      'That is not correct.'
    );
  });

  it('returns null if no quizData or showQuestionSection is false', () => {
    store.quizData = null;
    render(<QuizSection />);
    expect(screen.queryByTestId('quiz-section')).toBeNull();
    store.quizData = quizData;
    store.showQuestionSection = false;
    render(<QuizSection />);
    expect(screen.queryByTestId('quiz-section')).toBeNull();
  });
});
