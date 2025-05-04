import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Generator from './Generator';
import React from 'react';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockStore = {
  loading: false,
  quizData: null,
  isAnswered: false,
  generateText: vi.fn(),
  feedbackSubmitted: false,
  submitFeedback: vi.fn(),
  nextQuizAvailable: false,
  loadNextQuiz: vi.fn(),
};

vi.mock('@/store/textGeneratorStore', () => ({
  __esModule: true,
  default: () => mockStore,
}));

vi.mock('./QuizSkeleton', () => ({
  __esModule: true,
  default: () => <div data-testid="quiz-skeleton" />,
}));

beforeAll(() => {
  Object.defineProperty(HTMLDivElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
  });
});

describe('Generator', () => {
  beforeEach(() => {
    Object.assign(mockStore, {
      loading: false,
      quizData: null,
      isAnswered: false,
      generateText: vi.fn(),
      feedbackSubmitted: false,
      submitFeedback: vi.fn(),
      nextQuizAvailable: false,
      loadNextQuiz: vi.fn(),
    });
  });

  it('renders generate button when no quizData', () => {
    render(<Generator />);
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
  });

  it('calls generateText when generate button clicked and no nextQuizAvailable', () => {
    render(<Generator />);
    fireEvent.click(screen.getByTestId('generate-button'));
    expect(mockStore.generateText).toHaveBeenCalled();
  });

  it('calls loadNextQuiz when nextQuizAvailable is true', () => {
    mockStore.nextQuizAvailable = true;
    render(<Generator />);
    fireEvent.click(screen.getByTestId('generate-button'));
    expect(mockStore.loadNextQuiz).toHaveBeenCalled();
  });

  it('shows feedback prompt when answered, not feedbackSubmitted, not loading, authenticated', () => {
    mockStore.isAnswered = true;
    mockStore.feedbackSubmitted = false;
    mockStore.loading = false;
    render(<Generator />);
    expect(screen.getByText('Was this question helpful?')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-good-button')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-bad-button')).toBeInTheDocument();
  });

  it('calls submitFeedback(true) when good button clicked', () => {
    mockStore.isAnswered = true;
    render(<Generator />);
    fireEvent.click(screen.getByTestId('feedback-good-button'));
    expect(mockStore.submitFeedback).toHaveBeenCalledWith(true);
  });

  it('calls submitFeedback(false) when bad button clicked', () => {
    mockStore.isAnswered = true;
    render(<Generator />);
    fireEvent.click(screen.getByTestId('feedback-bad-button'));
    expect(mockStore.submitFeedback).toHaveBeenCalledWith(false);
  });

  it('shows QuizSkeleton when loading and feedback not submitted', () => {
    mockStore.isAnswered = true;
    mockStore.feedbackSubmitted = false;
    mockStore.loading = true;
    render(<Generator />);
    expect(screen.getByTestId('quiz-skeleton')).toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    mockStore.isAnswered = true;
    mockStore.loading = true;
    mockStore.feedbackSubmitted = false;
    render(<Generator />);
    screen.getAllByTestId('generate-button').forEach((btn) => { expect(btn).toBeDisabled(); });
    mockStore.isAnswered = false;
    render(<Generator />);
    screen.getAllByTestId('generate-button').forEach((btn) => { expect(btn).toBeDisabled(); });
  });

  it('does not show feedback prompt if not authenticated', async () => {
    vi.resetModules();
    vi.doMock('next-auth/react', () => ({
      useSession: () => ({ status: 'unauthenticated' }),
    }));
    const { default: UnauthedGenerator } = await import('./Generator');
    mockStore.isAnswered = true;
    mockStore.feedbackSubmitted = false;
    mockStore.loading = false;
    render(<UnauthedGenerator />);
    expect(screen.queryByText('Was this question helpful?')).not.toBeInTheDocument();
    vi.resetModules();
  });

  it('shows generate button after feedback submitted', () => {
    mockStore.isAnswered = true;
    mockStore.feedbackSubmitted = true;
    render(<Generator />);
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
  });
});
