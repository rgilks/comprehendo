import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import TextGeneratorContainer from './TextGeneratorContainer';

vi.mock('next-auth/react');
vi.mock('@/contexts/LanguageContext');
vi.mock('@/store/textGeneratorStore');
vi.mock('./LanguageSelector', () => ({ default: () => <div>LanguageSelector</div> }));
vi.mock('./LoginPrompt', () => ({ default: () => <div>LoginPrompt</div> }));
vi.mock('./ErrorDisplay', () => ({ default: () => <div>ErrorDisplay</div> }));
vi.mock('./QuizSkeleton', () => ({ default: () => <div>QuizSkeleton</div> }));
vi.mock('./ReadingPassage', () => ({ default: () => <div>ReadingPassage</div> }));
vi.mock('./QuizSection', () => ({ default: () => <div>QuizSection</div> }));
vi.mock('./ProgressTracker', () => ({ default: () => <div>ProgressTracker</div> }));
vi.mock('./Generator', () => ({ default: () => <div>Generator</div> }));

describe('TextGeneratorContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLanguage as any).mockReturnValue({ language: 'en' });
    (useTextGeneratorStore as any).mockReturnValue({
      loading: false,
      quizData: null,
      showContent: false,
      isAnswered: false,
      fetchUserProgress: vi.fn(),
    });
  });

  it('renders all static child components', () => {
    (useSession as any).mockReturnValue({ status: 'unauthenticated' });
    render(<TextGeneratorContainer />);
    expect(screen.getByText('LanguageSelector')).toBeInTheDocument();
    expect(screen.getByText('LoginPrompt')).toBeInTheDocument();
    expect(screen.getByText('ErrorDisplay')).toBeInTheDocument();
    expect(screen.getByText('Generator')).toBeInTheDocument();
  });

  it('shows QuizSkeleton when loading and no quizData', () => {
    (useTextGeneratorStore as any).mockReturnValue({
      loading: true,
      quizData: null,
      showContent: false,
      isAnswered: false,
      fetchUserProgress: vi.fn(),
    });
    render(<TextGeneratorContainer />);
    expect(screen.getByText('QuizSkeleton')).toBeInTheDocument();
  });

  it('shows generated content when quizData and showContent', () => {
    (useTextGeneratorStore as any).mockReturnValue({
      loading: false,
      quizData: { id: 1 },
      showContent: true,
      isAnswered: false,
      fetchUserProgress: vi.fn(),
    });
    render(<TextGeneratorContainer />);
    expect(screen.getByText('ReadingPassage')).toBeInTheDocument();
    expect(screen.getByText('QuizSection')).toBeInTheDocument();
  });

  it('shows ProgressTracker when isAnswered', () => {
    (useTextGeneratorStore as any).mockReturnValue({
      loading: false,
      quizData: { id: 1 },
      showContent: false,
      isAnswered: true,
      fetchUserProgress: vi.fn(),
    });
    render(<TextGeneratorContainer />);
    expect(screen.getByText('ProgressTracker')).toBeInTheDocument();
  });

  it('shows ProgressTracker when not content visible and not loading', () => {
    (useTextGeneratorStore as any).mockReturnValue({
      loading: false,
      quizData: null,
      showContent: false,
      isAnswered: false,
      fetchUserProgress: vi.fn(),
    });
    render(<TextGeneratorContainer />);
    expect(screen.getByText('ProgressTracker')).toBeInTheDocument();
  });

  it('fetches user progress when authenticated', () => {
    const fetchUserProgress = vi.fn();
    (useSession as any).mockReturnValue({ status: 'authenticated' });
    (useTextGeneratorStore as any).mockReturnValue({
      loading: false,
      quizData: null,
      showContent: false,
      isAnswered: false,
      fetchUserProgress,
    });
    render(<TextGeneratorContainer />);
    expect(fetchUserProgress).toHaveBeenCalled();
  });
});
