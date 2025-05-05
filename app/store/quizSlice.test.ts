import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TextGeneratorState } from './textGeneratorStore';
import { createQuizSlice, INITIAL_HOVER_CREDITS } from './quizSlice';
import type { BaseSlice } from './baseSlice';
import type { UISlice } from './uiSlice';
import type { SettingsSlice } from './settingsSlice';
import type { PartialQuizData } from '@/lib/domain/schemas';
import { generateExerciseResponse } from '@/app/actions/exercise';
import { submitAnswer, submitQuestionFeedback } from '@/app/actions/userProgress';

vi.mock('@/app/actions/userProgress', () => ({
  submitAnswer: vi.fn(),
  submitQuestionFeedback: vi.fn(),
}));
vi.mock('@/app/actions/exercise', () => ({
  generateExerciseResponse: vi.fn(),
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
  fetchUserProgress: vi.fn(),
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
        fetchUserProgress: mockOtherStateAndFunctions.fetchUserProgress,
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
    vi.mocked(submitQuestionFeedback).mockClear();
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
    const generateTextSpy = vi.spyOn(store.getState(), 'generateText');
    store.setState({ nextQuizAvailable: { quizData: nextQuizData, quizId: nextQuizId } });
    store.getState().loadNextQuiz();
    expect(resetQuizWithNewDataSpy).toHaveBeenCalledWith(nextQuizData, nextQuizId);
    expect(generateTextSpy).toHaveBeenCalledWith(true);
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
});
