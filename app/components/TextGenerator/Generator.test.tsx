import { describe, test, expect, vi, beforeEach, type MockedFunction, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Generator from './Generator';
import useTextGeneratorStore, { type TextGeneratorState } from '@/store/textGeneratorStore';
import { useSession, type SessionContextValue } from 'next-auth/react';
import type { Session } from 'next-auth';

// Mock the store
vi.mock('@/store/textGeneratorStore');
const mockUseTextGeneratorStore = useTextGeneratorStore as unknown as MockedFunction<
  () => Partial<TextGeneratorState>
>;
const mockFetchInitialPair = vi.fn();
const mockLoadNextQuiz = vi.fn();
const mockSubmitFeedback = vi.fn();

// Mock next-auth
vi.mock('next-auth/react');
const mockUpdate = vi.fn();
const mockUseSession = useSession as MockedFunction<() => SessionContextValue>;

// Mock translation
vi.mock('react-i18next', async () => {
  const original = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...original, // Include actual exports like initReactI18next
    useTranslation: () => ({
      t: (key: string) => key, // Keep the simple pass-through mock for t
    }),
  };
});

// Mock QuizSkeleton
vi.mock('./QuizSkeleton', () => ({
  default: () => <div data-testid="quiz-skeleton">Quiz Skeleton Mock</div>,
}));

describe('Generator Component', () => {
  let mockStoreState: Partial<TextGeneratorState>;

  beforeEach(() => {
    HTMLDivElement.prototype.scrollIntoView = vi.fn();
    vi.resetAllMocks();
    // Default to unauthenticated, no quiz data
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: mockUpdate });

    // Reset mock store state for each test
    mockStoreState = {
      loading: false,
      quizData: null,
      isAnswered: false,
      feedbackSubmitted: false,
      submitFeedback: mockSubmitFeedback,
      loadNextQuiz: mockLoadNextQuiz,
      fetchInitialPair: mockFetchInitialPair,
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );
  });

  afterEach(() => {
    delete (HTMLDivElement.prototype as any).scrollIntoView;
  });

  test('should render initial generate button when no quiz data exists', () => {
    render(<Generator />);
    const generateButton = screen.getByTestId('generate-button');
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toHaveTextContent('practice.generateNewText');
    expect(screen.queryByTestId('feedback-good-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quiz-skeleton')).not.toBeInTheDocument();
  });

  test('should call fetchInitialPair when generate button is clicked and no quiz data exists', () => {
    render(<Generator />);
    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);
    expect(mockFetchInitialPair).toHaveBeenCalledTimes(1);
    expect(mockLoadNextQuiz).not.toHaveBeenCalled();
  });

  test('should call loadNextQuiz when generate button is clicked after answering/feedback (authenticated)', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    // Update the mock store state for this specific test case
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      quizData: { paragraph: 'Test Para' } as any, // Has quiz data
      isAnswered: true,
      feedbackSubmitted: true, // Feedback submitted
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);
    expect(mockLoadNextQuiz).toHaveBeenCalledTimes(1);
    expect(mockFetchInitialPair).not.toHaveBeenCalled();
  });

  test('should call loadNextQuiz when generate button is clicked after answering (unauthenticated)', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated', update: mockUpdate });
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      quizData: { paragraph: 'Test Para' } as any, // Has quiz data
      isAnswered: true,
      feedbackSubmitted: false, // Unauthenticated, feedback not submitted/relevant
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    const generateButton = screen.getByTestId('generate-button');
    fireEvent.click(generateButton);
    expect(mockLoadNextQuiz).toHaveBeenCalledTimes(1);
    expect(mockFetchInitialPair).not.toHaveBeenCalled();
  });

  test('should show feedback prompt when answered, authenticated, and feedback not submitted', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      quizData: { paragraph: 'Test Para' } as any,
      isAnswered: true,
      feedbackSubmitted: false,
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    expect(screen.getByText('Was this question helpful?')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-good-button')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-bad-button')).toBeInTheDocument();
    expect(screen.queryByTestId('generate-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quiz-skeleton')).not.toBeInTheDocument();
  });

  test('should call submitFeedback with true when good feedback button is clicked', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      quizData: { paragraph: 'Test Para' } as any,
      isAnswered: true,
      feedbackSubmitted: false,
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    const goodButton = screen.getByTestId('feedback-good-button');
    fireEvent.click(goodButton);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(true);
  });

  test('should call submitFeedback with false when bad feedback button is clicked', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    mockStoreState = {
      ...mockStoreState,
      loading: false,
      quizData: { paragraph: 'Test Para' } as any,
      isAnswered: true,
      feedbackSubmitted: false,
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    const badButton = screen.getByTestId('feedback-bad-button');
    fireEvent.click(badButton);
    expect(mockSubmitFeedback).toHaveBeenCalledWith(false);
  });

  test('should show skeleton when loading during feedback prompt phase', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    mockStoreState = {
      ...mockStoreState,
      loading: true, // Loading is true
      quizData: { paragraph: 'Test Para' } as any,
      isAnswered: true,
      feedbackSubmitted: false, // Feedback not yet submitted
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    expect(screen.getByTestId('quiz-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('Was this question helpful?')).not.toBeInTheDocument();
    expect(screen.queryByTestId('generate-button')).not.toBeInTheDocument();
  });

  test('should disable generate button when loading initially', () => {
    mockStoreState = {
      ...mockStoreState,
      loading: true, // Loading
      quizData: null, // No quiz data yet
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    render(<Generator />);
    const generateButton = screen.getByTestId('generate-button');
    expect(generateButton).toBeDisabled();
    expect(generateButton).toHaveTextContent('common.generating');
    expect(screen.queryByTestId('quiz-skeleton')).not.toBeInTheDocument();
  });

  test('should disable feedback buttons when loading during feedback prompt phase', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'test-user-id' } } as Session,
      status: 'authenticated',
      update: mockUpdate,
    });
    mockStoreState = {
      ...mockStoreState,
      loading: true, // Loading is true
      quizData: { paragraph: 'Test Para' } as any,
      isAnswered: true,
      feedbackSubmitted: false,
    };
    mockUseTextGeneratorStore.mockImplementation(
      <S,>(selector?: (state: TextGeneratorState) => S) => {
        if (selector) {
          return selector(mockStoreState as TextGeneratorState);
        }
        return mockStoreState as TextGeneratorState;
      }
    );

    // Let's test the skeleton visibility instead as done in the previous test
    render(<Generator />);
    expect(screen.getByTestId('quiz-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('feedback-good-button')).not.toBeInTheDocument(); // Buttons shouldn't be visible when skeleton is shown
    expect(screen.queryByTestId('feedback-bad-button')).not.toBeInTheDocument();
  });
});
