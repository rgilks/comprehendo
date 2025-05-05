import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TextGeneratorState } from './textGeneratorStore';
import { createQuizSlice, INITIAL_HOVER_CREDITS } from './quizSlice';
import type { BaseSlice } from './baseSlice';
import type { UISlice } from './uiSlice';
import type { SettingsSlice } from './settingsSlice';
import type { PartialQuizData } from '@/lib/domain/schemas';
import { generateExerciseResponse, generateInitialExercisePair } from '@/app/actions/exercise';
import { submitAnswer, submitFeedback } from '@/app/actions/progress';
import { InitialExercisePairResultSchema } from '@/lib/domain/schemas';

vi.mock('@/app/actions/progress', () => ({
  submitAnswer: vi.fn(),
  submitFeedback: vi.fn(),
}));
vi.mock('@/app/actions/exercise', () => ({
  generateExerciseResponse: vi.fn(),
  generateInitialExercisePair: vi.fn(),
}));

const mockBaseSlice: BaseSlice = {
  loading: false,
  error: null,
  showError: false,
  setLoading: vi.fn(),
  setError: vi.fn(),
};

const mockUISlice: UISlice = {
  ...mockBaseSlice,
  showLoginPrompt: false,
  showContent: true,
  showQuestionSection: false,
  showExplanation: false,
  setShowLoginPrompt: vi.fn(),
  setShowContent: vi.fn(),
  setShowQuestionSection: vi.fn(),
  setShowExplanation: vi.fn(),
};

const mockSettingsSlice: SettingsSlice = {
  ...mockBaseSlice,
  passageLanguage: 'en',
  generatedPassageLanguage: null,
  generatedQuestionLanguage: 'en',
  cefrLevel: 'A1',
  setPassageLanguage: vi.fn(),
  setGeneratedPassageLanguage: vi.fn(),
  setGeneratedQuestionLanguage: vi.fn(),
  setCefrLevel: vi.fn(),
};

const mockOtherStateAndFunctions = {
  isSpeechSupported: false,
  isSpeakingPassage: false,
  isPaused: false,
  volume: 1,
  rate: 1,
  currentWordIndex: null,
  currentSentenceIndex: null,
  voices: [],
  selectedVoiceURI: null,
  setVolume: vi.fn(),
  setRate: vi.fn(),
  setIsPaused: vi.fn(),
  setSelectedVoiceURI: vi.fn(),
  updateAvailableVoices: vi.fn(),
  speakPassage: vi.fn(),
  pauseSpeech: vi.fn(),
  resumeSpeech: vi.fn(),
  stopPassageSpeech: vi.fn(),
  isSpeaking: false,
  userStreak: 0,
  setUserStreak: vi.fn(),
  fetchProgress: vi.fn(),
  textSettings: {
    isPassageVisible: true,
    fontScale: 1,
    highlightWords: false,
    highlightSentences: false,
    highlightParagraphs: false,
    showTranslations: false,
    showQuestions: true,
    togglePassageVisibility: vi.fn(),
    setFontScale: vi.fn(),
    toggleHighlightWords: vi.fn(),
    toggleHighlightSentences: vi.fn(),
    toggleHighlightParagraphs: vi.fn(),
    toggleShowTranslations: vi.fn(),
    toggleShowQuestions: vi.fn(),
  },
};

const createTestStore = () =>
  create<TextGeneratorState>()(
    immer((set, get, store) => {
      const quizSliceInstance = createQuizSlice(set, get, store);

      const combinedState = {
        ...mockBaseSlice,
        ...mockUISlice,
        ...mockSettingsSlice,
        ...mockOtherStateAndFunctions,
        ...quizSliceInstance,
        stopPassageSpeech: mockOtherStateAndFunctions.stopPassageSpeech,
        generateText: quizSliceInstance.generateText,
        resetQuizWithNewData: quizSliceInstance.resetQuizWithNewData,
        resetQuizState: quizSliceInstance.resetQuizState,
        fetchProgress: mockOtherStateAndFunctions.fetchProgress,
        updateAvailableVoices: mockOtherStateAndFunctions.updateAvailableVoices,
      };
      return combinedState as unknown as TextGeneratorState;
    })
  );

describe('quizSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
    mockOtherStateAndFunctions.stopPassageSpeech.mockClear();
    vi.mocked(generateExerciseResponse).mockClear();
    vi.mocked(submitAnswer).mockClear();
    vi.mocked(submitFeedback).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const state = store.getState();
    expect(state.quizData).toBeNull();
    expect(state.currentQuizId).toBeNull();
    expect(state.selectedAnswer).toBeNull();
    expect(state.isAnswered).toBe(false);
    expect(state.relevantTextRange).toBeNull();
    expect(state.feedbackIsCorrect).toBeNull();
    expect(state.feedbackCorrectAnswer).toBeNull();
    expect(state.feedbackCorrectExplanation).toBeNull();
    expect(state.feedbackChosenIncorrectExplanation).toBeNull();
    expect(state.feedbackRelevantText).toBeNull();
    expect(state.nextQuizAvailable).toBeNull();
    expect(state.feedbackSubmitted).toBe(false);
    expect(state.hoverProgressionPhase).toBe('credits');
    expect(state.correctAnswersInPhase).toBe(0);
    expect(state.hoverCreditsAvailable).toBe(INITIAL_HOVER_CREDITS);
    expect(state.hoverCreditsUsed).toBe(0);
  });

  it('setQuizData should update quizData', () => {
    const mockQuizData: PartialQuizData = {
      paragraph: 'Test paragraph.',
      question: 'What is this?',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      language: 'en',
    };
    store.getState().setQuizData(mockQuizData);
    expect(store.getState().quizData).toEqual(mockQuizData);
    expect(store.getState().hoverCreditsAvailable).toBe(INITIAL_HOVER_CREDITS);
  });

  it('setSelectedAnswer should update selectedAnswer', () => {
    store.getState().setSelectedAnswer('A');
    expect(store.getState().selectedAnswer).toBe('A');
  });

  it('setIsAnswered should update isAnswered', () => {
    store.getState().setIsAnswered(true);
    expect(store.getState().isAnswered).toBe(true);
  });

  it('setRelevantTextRange should update relevantTextRange', () => {
    const range = { start: 5, end: 10 };
    store.getState().setRelevantTextRange(range);
    expect(store.getState().relevantTextRange).toEqual(range);
  });

  it('setNextQuizAvailable should update nextQuizAvailable', () => {
    const nextInfo = {
      quizData: {
        paragraph: 'Next P',
        question: 'Next Q',
        options: { A: 'NA', B: 'NB', C: 'NC', D: 'ND' },
      },
      quizId: 2,
    };
    store.getState().setNextQuizAvailable(nextInfo);
    expect(store.getState().nextQuizAvailable).toEqual(nextInfo);
  });

  it('resetQuizState should reset quiz related state', () => {
    const mockQuizData: PartialQuizData = {
      paragraph: 'Test paragraph.',
      question: 'What is this?',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      language: 'en',
    };
    store.setState({
      quizData: mockQuizData,
      currentQuizId: 1,
      selectedAnswer: 'A',
      isAnswered: true,
      relevantTextRange: { start: 0, end: 4 },
      feedbackIsCorrect: true,
      feedbackCorrectAnswer: 'A',
      feedbackCorrectExplanation: 'Because.',
      feedbackChosenIncorrectExplanation: null,
      feedbackRelevantText: 'Test',
      showQuestionSection: true,
      showExplanation: true,
      nextQuizAvailable: {
        quizData: { ...mockQuizData, paragraph: 'Next para' },
        quizId: 2,
      },
      feedbackSubmitted: true,
      hoverCreditsUsed: 2,
    });

    store.getState().resetQuizState();

    const state = store.getState();
    expect(state.quizData).toBeNull();
    expect(state.currentQuizId).toBeNull();
    expect(state.selectedAnswer).toBeNull();
    expect(state.isAnswered).toBe(false);
    expect(state.relevantTextRange).toBeNull();
    expect(state.feedbackIsCorrect).toBeNull();
    expect(state.feedbackCorrectAnswer).toBeNull();
    expect(state.feedbackCorrectExplanation).toBeNull();
    expect(state.feedbackChosenIncorrectExplanation).toBeNull();
    expect(state.feedbackRelevantText).toBeNull();
    expect(state.showQuestionSection).toBe(false);
    expect(state.showExplanation).toBe(false);
    expect(state.nextQuizAvailable).toBeNull();
    expect(state.feedbackSubmitted).toBe(false);
    expect(state.hoverCreditsUsed).toBe(0);
    expect(state.hoverCreditsAvailable).toBe(INITIAL_HOVER_CREDITS);
  });

  it('resetQuizWithNewData should reset state and set new quiz data', () => {
    const newQuizData: PartialQuizData = {
      paragraph: 'New P',
      question: 'New Q',
      options: { A: 'NA', B: 'NB', C: 'NC', D: 'ND' },
    };
    const newQuizId = 10;
    const generateTextSpy = vi.spyOn(store.getState(), 'generateText');

    store.setState({ passageLanguage: 'fr' });

    store.getState().resetQuizWithNewData(newQuizData, newQuizId);

    expect(mockOtherStateAndFunctions.stopPassageSpeech).toHaveBeenCalled();
    expect(store.getState().selectedAnswer).toBeNull();

    const state = store.getState();
    expect(state.quizData).toEqual(newQuizData);
    expect(state.currentQuizId).toBe(newQuizId);
    expect(state.showQuestionSection).toBe(true);
    expect(state.showExplanation).toBe(false);
    expect(state.showContent).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.generatedPassageLanguage).toBe('fr');

    expect(generateTextSpy).toHaveBeenCalledWith(true);
  });

  it('loadNextQuiz should call resetQuizWithNewData if next quiz is available', () => {
    const nextQuizData: PartialQuizData = {
      paragraph: 'Next P',
      question: 'Next Q',
      options: { A: '1', B: '2', C: '3', D: '4' },
    };
    const nextQuizId = 11;
    const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');
    store.setState({ nextQuizAvailable: { quizData: nextQuizData, quizId: nextQuizId } });
    store.getState().loadNextQuiz();
    expect(resetQuizWithNewDataSpy).toHaveBeenCalledWith(nextQuizData, nextQuizId);
  });

  it('loadNextQuiz should call generateText if next quiz is not available', () => {
    const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');
    const generateTextSpy = vi.spyOn(store.getState(), 'generateText');

    store.setState({ nextQuizAvailable: null });

    store.getState().loadNextQuiz();

    expect(resetQuizWithNewDataSpy).not.toHaveBeenCalled();
    expect(generateTextSpy).toHaveBeenCalled();
  });

  it('useHoverCredit should decrement credits and return true if available', () => {
    store.setState({ hoverCreditsAvailable: 5, hoverCreditsUsed: 2 });
    const result = store.getState().useHoverCredit();
    expect(result).toBe(true);
    expect(store.getState().hoverCreditsAvailable).toBe(4);
    expect(store.getState().hoverCreditsUsed).toBe(3);
  });

  it('useHoverCredit should return false if no credits available', () => {
    store.setState({ hoverCreditsAvailable: 0, hoverCreditsUsed: INITIAL_HOVER_CREDITS });
    const result = store.getState().useHoverCredit();
    expect(result).toBe(false);
    expect(store.getState().hoverCreditsAvailable).toBe(0);
    expect(store.getState().hoverCreditsUsed).toBe(INITIAL_HOVER_CREDITS);
  });

  describe('generateText', () => {
    const mockQuizData: PartialQuizData = {
      paragraph: 'Generated P',
      question: 'Gen Q?',
      options: { A: 'GA', B: 'GB', C: 'GC', D: 'GD' },
      language: 'en',
    };
    const mockResponse = { quizData: mockQuizData, quizId: 5 };

    it('should generate text, reset state, and set new data when not prefetching', async () => {
      vi.mocked(generateExerciseResponse).mockResolvedValue(mockResponse);
      const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');

      store.setState({ passageLanguage: 'de', generatedQuestionLanguage: 'de', cefrLevel: 'B1' });
      await store.getState().generateText(false);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(mockOtherStateAndFunctions.stopPassageSpeech).toHaveBeenCalled();
      expect(resetQuizWithNewDataSpy).toHaveBeenCalledWith(mockQuizData, 5);
      expect(generateExerciseResponse).toHaveBeenCalledWith({
        passageLanguage: 'de',
        questionLanguage: 'de',
        cefrLevel: 'B1',
      });
    });

    it('should prefetch next quiz data without resetting state', async () => {
      vi.mocked(generateExerciseResponse).mockResolvedValue(mockResponse);
      const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');
      const resetQuizStateSpy = vi.spyOn(store.getState(), 'resetQuizState');

      store.setState({ passageLanguage: 'fr', generatedQuestionLanguage: 'en', cefrLevel: 'A2' });
      await store.getState().generateText(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(mockOtherStateAndFunctions.stopPassageSpeech).not.toHaveBeenCalled();
      expect(resetQuizStateSpy).not.toHaveBeenCalled();
      expect(resetQuizWithNewDataSpy).not.toHaveBeenCalled();
      expect(generateExerciseResponse).toHaveBeenCalledWith({
        passageLanguage: 'fr',
        questionLanguage: 'en',
        cefrLevel: 'A2',
      });
      expect(store.getState().nextQuizAvailable).toEqual({ quizData: mockQuizData, quizId: 5 });
    });

    it.skip('should handle API error during generation (not prefetch)', async () => {
      const error = new Error('API Generation Failed');
      vi.mocked(generateExerciseResponse).mockRejectedValue(error);
      const resetQuizStateSpy = vi.spyOn(store.getState(), 'resetQuizState');

      await store.getState().generateText(false);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe('API Generation Failed');
      expect(mockOtherStateAndFunctions.stopPassageSpeech).toHaveBeenCalled();
      expect(resetQuizStateSpy).toHaveBeenCalled();
      expect(mockUISlice.setShowContent).toHaveBeenCalledWith(false);
    });

    it('should handle API error gracefully during prefetch (should not set error state)', async () => {
      const error = new Error('API Prefetch Failed');
      vi.mocked(generateExerciseResponse).mockRejectedValue(error);

      await store.getState().generateText(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(store.getState().nextQuizAvailable).toBeNull();
    });

    it.skip('should handle Zod validation error during generation', async () => {
      const invalidResponse = { quizData: { paragraph: 'Only para' }, quizId: 6 };
      vi.mocked(generateExerciseResponse).mockResolvedValue(invalidResponse as any);

      await store.getState().generateText(false);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toMatch(/Invalid API response structure:/);
      expect(mockUISlice.setShowContent).toHaveBeenCalledWith(false);
    });

    it.skip('should handle API response with error property', async () => {
      const mockQuizData: PartialQuizData = {
        paragraph: '',
        question: '',
        options: { A: '', B: '', C: '', D: '' },
      };
      const errorResponse = { quizData: mockQuizData, quizId: 0, error: 'Backend error message' };
      vi.mocked(generateExerciseResponse).mockResolvedValue(errorResponse);

      await store.getState().generateText(false);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe('Backend error message');
      expect(mockBaseSlice.setError).toHaveBeenCalledWith('Backend error message');
      expect(mockUISlice.setShowContent).toHaveBeenCalledWith(false);
    });
  });

  describe('handleAnswerSelect', () => {
    const mockQuizData: PartialQuizData = {
      paragraph: 'This is the relevant text.',
      question: 'Q?',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
      language: 'en',
    };

    beforeEach(() => {
      store.setState({
        currentQuizId: 1,
        isAnswered: false,
        passageLanguage: 'en',
        generatedQuestionLanguage: 'en',
        cefrLevel: 'A1',
        quizData: mockQuizData,
      });
    });

    it('should submit answer, update feedback (correct), and find relevant text', async () => {
      const mockResult = {
        feedback: {
          isCorrect: true,
          correctAnswer: 'A',
          correctExplanation: 'Correct explanation',
          chosenIncorrectExplanation: null,
          relevantText: 'relevant text',
        },
        currentStreak: 5,
        leveledUp: false,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockResult);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().isAnswered).toBe(true);
      expect(store.getState().selectedAnswer).toBe('A');
      expect(store.getState().showExplanation).toBe(true);
      expect(store.getState().feedbackIsCorrect).toBe(true);
      expect(store.getState().feedbackCorrectAnswer).toBe('A');
      expect(store.getState().feedbackCorrectExplanation).toBe('Correct explanation');
      expect(store.getState().feedbackChosenIncorrectExplanation).toBeNull();
      expect(store.getState().feedbackRelevantText).toBe('relevant text');
      expect(store.getState().relevantTextRange).toEqual({ start: 12, end: 25 });
      expect(store.getState().userStreak).toBe(5);
      expect(submitAnswer).toHaveBeenCalledWith({
        id: 1,
        ans: 'A',
        learn: 'en',
        lang: 'en',
        cefrLevel: 'A1',
      });
    });

    it('should submit answer, update feedback (incorrect)', async () => {
      const mockResult = {
        feedback: {
          isCorrect: false,
          correctAnswer: 'B',
          correctExplanation: 'Correct B explanation',
          chosenIncorrectExplanation: 'Incorrect A explanation',
          relevantText: '',
        },
        currentStreak: 0,
        leveledUp: false,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockResult);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().feedbackIsCorrect).toBe(false);
      expect(store.getState().feedbackCorrectAnswer).toBe('B');
      expect(store.getState().feedbackCorrectExplanation).toBe('Correct B explanation');
      expect(store.getState().feedbackChosenIncorrectExplanation).toBe('Incorrect A explanation');
      expect(store.getState().feedbackRelevantText).toBe('');
      expect(store.getState().relevantTextRange).toBeNull();
      expect(store.getState().userStreak).toBe(0);
    });

    it('should update level if leveledUp is true', async () => {
      const mockResult = {
        feedback: {
          isCorrect: true,
          correctAnswer: 'A',
          relevantText: 'text',
          correctExplanation: 'Exp',
        },
        currentStreak: 10,
        leveledUp: true,
        currentLevel: 'A2',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockResult);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().cefrLevel).toBe('A2');
    });

    it('should handle hover progression phase logic (correct answer, initial phase, meets threshold)', async () => {
      const mockFullResult = {
        feedback: {
          isCorrect: true,
          correctAnswer: 'A',
          correctExplanation: 'Explanation',
          relevantText: 'text',
        },
        currentStreak: 1,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockFullResult);
      store.setState({ hoverProgressionPhase: 'initial', correctAnswersInPhase: 4 });

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().hoverProgressionPhase).toBe('credits');
      expect(store.getState().correctAnswersInPhase).toBe(0);
    });

    it('should handle hover progression phase logic (correct answer, initial phase, below threshold)', async () => {
      const mockFullResult = {
        feedback: {
          isCorrect: true,
          correctAnswer: 'A',
          correctExplanation: 'Explanation',
          relevantText: 'text',
        },
        currentStreak: 1,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockFullResult);
      store.setState({ hoverProgressionPhase: 'initial', correctAnswersInPhase: 2 });

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().hoverProgressionPhase).toBe('initial');
      expect(store.getState().correctAnswersInPhase).toBe(3);
    });

    it('should handle hover progression phase logic (incorrect answer, initial phase)', async () => {
      const mockFullResult = {
        feedback: {
          isCorrect: false,
          correctAnswer: 'B',
          correctExplanation: 'Explanation B',
          chosenIncorrectExplanation: 'Explanation A',
          relevantText: 'text',
        },
        currentStreak: 0,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockFullResult);
      store.setState({ hoverProgressionPhase: 'initial', correctAnswersInPhase: 3 });

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().hoverProgressionPhase).toBe('initial');
      expect(store.getState().correctAnswersInPhase).toBe(0);
    });

    it('should handle hover progression phase logic (correct answer, credits phase)', async () => {
      const mockFullResult = {
        feedback: {
          isCorrect: true,
          correctAnswer: 'A',
          correctExplanation: 'Explanation',
          relevantText: 'text',
        },
        currentStreak: 1,
        currentLevel: 'A1',
      };
      vi.mocked(submitAnswer).mockResolvedValue(mockFullResult);
      store.setState({ hoverProgressionPhase: 'credits', correctAnswersInPhase: 1 });

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().hoverProgressionPhase).toBe('credits');
      expect(store.getState().correctAnswersInPhase).toBe(2);
    });

    it('should set error if currentQuizId is missing', async () => {
      store.setState({ currentQuizId: null });
      await store.getState().handleAnswerSelect('A');

      expect(store.getState().error).toBe('Cannot submit answer: Invalid quiz ID.');
      expect(store.getState().isAnswered).toBe(false);
      expect(store.getState().selectedAnswer).toBeNull();
      expect(submitAnswer).not.toHaveBeenCalled();
    });

    it('should set error if generatedQuestionLanguage is missing', async () => {
      store.setState({ generatedQuestionLanguage: null });
      await store.getState().handleAnswerSelect('A');

      expect(store.getState().error).toBe('Question language missing');
      expect(store.getState().isAnswered).toBe(true);
      expect(store.getState().selectedAnswer).toBe('A');
      expect(submitAnswer).not.toHaveBeenCalled();
    });

    it('should handle API error during submission', async () => {
      const error = new Error('API Submit Failed');
      vi.mocked(submitAnswer).mockRejectedValue(error);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().error).toBe('API Submit Failed');
    });

    it('should handle API response with error property', async () => {
      const errorResponse = { error: 'Backend submit error' };
      vi.mocked(submitAnswer).mockResolvedValue(errorResponse as any);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().error).toBe('Backend submit error');
    });

    it('should handle Zod validation error during submission', async () => {
      const invalidResult = { feedback: { isCorrect: 'maybe' } };
      vi.mocked(submitAnswer).mockResolvedValue(invalidResult as any);

      await store.getState().handleAnswerSelect('A');

      expect(store.getState().error).toMatch(/Invalid API response structure:/);
    });

    it('should not submit if already answered', async () => {
      store.setState({ isAnswered: true });
      await store.getState().handleAnswerSelect('B');
      expect(submitAnswer).not.toHaveBeenCalled();
    });
  });

  describe('submitFeedback', () => {
    const nextQuizData: PartialQuizData = {
      paragraph: 'Next P',
      question: 'Next Q',
      options: { A: 'A', B: 'B', C: 'C', D: 'D' },
    };
    const nextQuizInfo = { quizData: nextQuizData, quizId: 2 };

    beforeEach(() => {
      store.setState({
        currentQuizId: 1,
        selectedAnswer: 'A',
        feedbackIsCorrect: true,
        passageLanguage: 'es',
        generatedQuestionLanguage: 'en',
        cefrLevel: 'B2',
      });
    });

    it.skip('should submit feedback, set feedbackSubmitted, and load next quiz if available', async () => {
      vi.mocked(submitFeedback).mockResolvedValue({ success: true });
      store.setState({ nextQuizAvailable: nextQuizInfo });
      const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');

      await store.getState().submitFeedback(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(store.getState().feedbackSubmitted).toBe(true);
      expect(submitFeedback).toHaveBeenCalledWith({
        quizId: 1,
        is_good: 1,
        userAnswer: 'A',
        isCorrect: true,
        passageLanguage: 'es',
        questionLanguage: 'en',
        currentLevel: 'B2',
      });
      expect(resetQuizWithNewDataSpy).toHaveBeenCalledWith(nextQuizData, 2);
    });

    it.skip('should submit feedback (bad) and not load next quiz if not available', async () => {
      vi.mocked(submitFeedback).mockResolvedValue({ success: true });
      store.setState({ nextQuizAvailable: null });
      const resetQuizWithNewDataSpy = vi.spyOn(store.getState(), 'resetQuizWithNewData');

      await store.getState().submitFeedback(false);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(store.getState().feedbackSubmitted).toBe(true);
      expect(submitFeedback).toHaveBeenCalledWith(expect.objectContaining({ is_good: 0 }));
      expect(resetQuizWithNewDataSpy).not.toHaveBeenCalled();
    });

    it('should set error if currentQuizId is missing', async () => {
      store.setState({ currentQuizId: null });
      await store.getState().submitFeedback(true);

      expect(store.getState().error).toBe('Cannot submit feedback: Invalid quiz ID.');
      expect(store.getState().loading).toBe(false);
      expect(store.getState().feedbackSubmitted).toBe(false);
      expect(submitFeedback).not.toHaveBeenCalled();
    });

    it('should set error if generatedQuestionLanguage is missing', async () => {
      store.setState({ generatedQuestionLanguage: null });
      await store.getState().submitFeedback(true);

      expect(store.getState().error).toBe(
        'Cannot submit feedback: Missing required state (language/level). Please refresh.'
      );
      expect(store.getState().loading).toBe(false);
      expect(store.getState().feedbackSubmitted).toBe(false);
      expect(submitFeedback).not.toHaveBeenCalled();
    });

    it('should handle API error response (success: false)', async () => {
      vi.mocked(submitFeedback).mockResolvedValue({
        success: false,
        error: 'API Feedback Failed',
      });
      await store.getState().submitFeedback(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe('Failed to submit feedback: API Feedback Failed');
      expect(store.getState().feedbackSubmitted).toBe(false);
    });

    it('should handle API error response (success: false, no error message)', async () => {
      vi.mocked(submitFeedback).mockResolvedValue({ success: false });
      await store.getState().submitFeedback(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe(
        'Failed to submit feedback: Failed to submit feedback via API.'
      );
      expect(store.getState().feedbackSubmitted).toBe(false);
    });

    it('should handle thrown error during submission', async () => {
      const error = new Error('Network Error');
      vi.mocked(submitFeedback).mockRejectedValue(error);
      await store.getState().submitFeedback(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe('Failed to submit feedback: Network Error');
      expect(store.getState().feedbackSubmitted).toBe(false);
    });

    it('should handle thrown non-error object during submission', async () => {
      const error = { message: 'Non-error object' };
      vi.mocked(submitFeedback).mockRejectedValue(error);
      await store.getState().submitFeedback(true);

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe('Failed to submit feedback: Unknown error');
      expect(store.getState().feedbackSubmitted).toBe(false);
    });
  });

  describe('fetchInitialPair', () => {
    beforeEach(() => {
      store.setState({
        passageLanguage: 'en',
        generatedQuestionLanguage: 'es',
        cefrLevel: 'A1',
      });
      vi.mocked(generateInitialExercisePair).mockClear();
    });

    test('should fetch initial pair, update state, and set loading states', async () => {
      vi.mocked(generateInitialExercisePair).mockResolvedValue({
        quizzes: [
          {
            quizData: {
              paragraph: 'Quiz 1 Para',
              question: 'Quiz 1 Q?',
              options: { A: 'A', B: 'B', C: 'C', D: 'D' },
              language: 'en',
            },
            quizId: 1,
            error: null,
            cached: false,
          },
          {
            quizData: {
              paragraph: 'Quiz 2 Para',
              question: 'Quiz 2 Q?',
              options: { A: 'A', B: 'B', C: 'C', D: 'D' },
              language: 'en',
            },
            quizId: 2,
            error: null,
            cached: false,
          },
        ],
        error: null,
      });
      store.setState({ loading: false, error: 'old error', showContent: false });

      const promise = store.getState().fetchInitialPair();

      expect(store.getState().loading).toBe(true);
      expect(store.getState().error).toBeNull();
      expect(store.getState().showContent).toBe(false);

      await promise;

      expect(generateInitialExercisePair).toHaveBeenCalledTimes(1);
      expect(generateInitialExercisePair).toHaveBeenCalledWith({
        passageLanguage: 'en',
        questionLanguage: 'es',
        cefrLevel: 'A1',
      });

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBeNull();
      expect(store.getState().showContent).toBe(true);
      expect(store.getState().quizData).toEqual({
        paragraph: 'Quiz 1 Para',
        question: 'Quiz 1 Q?',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        language: 'en',
      });
      expect(store.getState().currentQuizId).toBe(1);
      expect(store.getState().generatedPassageLanguage).toBe('en');
      expect(store.getState().nextQuizAvailable).toEqual({
        quizData: {
          paragraph: 'Quiz 2 Para',
          question: 'Quiz 2 Q?',
          options: { A: 'A', B: 'B', C: 'C', D: 'D' },
          language: 'en',
        },
        quizId: 2,
      });
      expect(store.getState().isAnswered).toBe(false);
      expect(store.getState().selectedAnswer).toBeNull();
      expect(store.getState().feedbackSubmitted).toBe(false);
    });

    test('should handle API error during fetchInitialPair', async () => {
      const apiError = 'Network Error';
      const mockApiResponseWithError = {
        quizzes: [
          { quizData: {} as any, quizId: -1, error: null, cached: false },
          { quizData: {} as any, quizId: -1, error: null, cached: false },
        ],
        error: apiError,
      };
      vi.mocked(generateInitialExercisePair).mockResolvedValue(mockApiResponseWithError);

      const safeParseSpy = vi.spyOn(InitialExercisePairResultSchema, 'safeParse');
      safeParseSpy.mockReturnValueOnce({ success: true, data: mockApiResponseWithError } as any);

      store.setState({ loading: false, error: null, showContent: true });

      await store.getState().fetchInitialPair();

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe(apiError);
      expect(store.getState().showContent).toBe(false);
      expect(store.getState().quizData).toBeNull();
      expect(store.getState().currentQuizId).toBeNull();
      expect(store.getState().nextQuizAvailable).toBeNull();

      safeParseSpy.mockRestore();
    });

    test('should handle validation error for fetchInitialPair response', async () => {
      const structurallyValidButSemanticallyIncorrect = {
        quizzes: [
          { quizData: {}, quizId: 1, error: null, cached: false },
          { quizData: {}, quizId: 2, error: null, cached: false },
        ],
        error: null,
      };
      vi.mocked(generateInitialExercisePair).mockResolvedValue(
        structurallyValidButSemanticallyIncorrect as any
      );
      store.setState({ loading: false, error: null, showContent: true });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const safeParseSpy = vi.spyOn(InitialExercisePairResultSchema, 'safeParse');
      const mockValidationError = {
        success: false,
        error: {
          message: 'Mock Zod Error',
          format: () => 'Formatted Mock Zod Error',
        },
      };
      safeParseSpy.mockReturnValue(mockValidationError as any);

      await store.getState().fetchInitialPair();

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toContain('Invalid API response structure: Mock Zod Error');
      expect(store.getState().showContent).toBe(false);
      expect(store.getState().quizData).toBeNull();
      expect(store.getState().nextQuizAvailable).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      safeParseSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should handle thrown error during fetchInitialPair', async () => {
      const thrownError = new Error('Something went wrong');
      vi.mocked(generateInitialExercisePair).mockRejectedValue(thrownError);
      store.setState({ loading: false, error: null, showContent: true });

      await store.getState().fetchInitialPair();

      expect(store.getState().loading).toBe(false);
      expect(store.getState().error).toBe(thrownError.message);
      expect(store.getState().showContent).toBe(false);
      expect(store.getState().quizData).toBeNull();
      expect(store.getState().nextQuizAvailable).toBeNull();
    });

    test('should reset quiz state correctly before fetching', async () => {
      vi.mocked(generateInitialExercisePair).mockResolvedValue({
        quizzes: [
          {
            quizData: {
              paragraph: 'Quiz 1 Para',
              question: 'Quiz 1 Q?',
              options: { A: 'A', B: 'B', C: 'C', D: 'D' },
              language: 'en',
            },
            quizId: 1,
            error: null,
            cached: false,
          },
          {
            quizData: {
              paragraph: 'Quiz 2 Para',
              question: 'Quiz 2 Q?',
              options: { A: 'A', B: 'B', C: 'C', D: 'D' },
              language: 'en',
            },
            quizId: 2,
            error: null,
            cached: false,
          },
        ],
        error: null,
      });
      store.setState({
        quizData: { paragraph: 'Old data' } as any,
        currentQuizId: 99,
        isAnswered: true,
        selectedAnswer: 'A',
        feedbackSubmitted: true,
        nextQuizAvailable: { quizData: {} as any, quizId: 100 },
        loading: false,
        error: null,
        showContent: true,
      });

      const resetSpy = vi.spyOn(store.getState(), 'resetQuizState');

      await store.getState().fetchInitialPair();

      expect(resetSpy).toHaveBeenCalled();
      expect(store.getState().quizData).toEqual({
        paragraph: 'Quiz 1 Para',
        question: 'Quiz 1 Q?',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        language: 'en',
      });
      expect(store.getState().currentQuizId).toBe(1);
      expect(store.getState().nextQuizAvailable).toEqual({
        quizData: {
          paragraph: 'Quiz 2 Para',
          question: 'Quiz 2 Q?',
          options: { A: 'A', B: 'B', C: 'C', D: 'D' },
          language: 'en',
        },
        quizId: 2,
      });
    });
  });
});
