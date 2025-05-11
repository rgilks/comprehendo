import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createBaseSlice } from './baseSlice';
import type { TextGeneratorState } from '@/app/store/textGeneratorStore';
import type { ProgressUpdateResult } from '@/lib/domain/progress';
import type { LearningLanguage } from '@/lib/domain/language';
import { UI_LANGUAGES } from '@/lib/domain/language';
import type { CEFRLevel } from '@/lib/domain/language-guidance';

// Hoist mocks
const { mockGetProgress, mockGetSession } = vi.hoisted(() => {
  return {
    mockGetProgress: vi.fn(),
    mockGetSession: vi.fn(),
  };
});

// Mock the actions and hooks using hoisted variables
vi.mock('@/app/actions/progress', () => ({ getProgress: mockGetProgress }));
vi.mock('next-auth/react', () => ({ getSession: mockGetSession }));

import { createProgressSlice } from './progressSlice';

// Minimal mocks for other slices if needed by progressSlice logic
const createMockOtherSlices = (_set: any, _get: any, _api: any) => ({
  passageLanguage: 'en' as LearningLanguage,
  cefrLevel: 'A1' as CEFRLevel,
});

const setupStore = () =>
  create<TextGeneratorState>()(
    immer((set, get, api) => ({
      ...createBaseSlice(set),
      ...createProgressSlice(set, get, api),
      ...createMockOtherSlices(set, get, api),
      isQuizComplete: false,
      resetState: vi.fn(),
      setPassageLanguage: vi.fn(),
      currentPassage: null,
      passageAudio: null,
      isGenerating: false,
      isLoadingPassage: false,
      isLoadingAudio: false,
      isAudioPlaying: false,
      playbackSpeed: 1,
      currentSentenceIndex: 0,
      volume: 0.5,
      selectedVoice: null,
      quizQuestions: [],
      currentQuestionIndex: 0,
      userAnswers: {},
      score: 0,
      isSubmitting: false,
      quizStartTime: null,
      quizEndTime: null,
      translations: {},
      translatedWordDetails: null,
      isTranslationLoading: false,
      loading: false,
      error: null,
      showError: false,
      isProgressLoading: false,
      userStreak: null,
      showLoginPrompt: false,
      showContent: false,
      showQuestionSection: false,
      showExplanation: false,
      setShowLoginPrompt: vi.fn(),
      setShowContent: vi.fn(),
      setShowQuestionSection: vi.fn(),
      setShowExplanation: vi.fn(),
      generatedPassageLanguage: null,
      generatedQuestionLanguage: null,
      setGeneratedPassageLanguage: vi.fn(),
      setGeneratedQuestionLanguage: vi.fn(),
      setCefrLevel: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearError: vi.fn(),
      quizData: null,
      currentQuizId: null,
      selectedAnswer: null,
      isAnswered: false,
      relevantTextRange: null,
      feedbackIsCorrect: null,
      feedbackCorrectAnswer: null,
      feedbackCorrectExplanation: null,
      feedbackChosenIncorrectExplanation: null,
      feedbackRelevantText: null,
      nextQuizAvailable: null,
      feedbackSubmitted: false,
      hoverProgressionPhase: 'credits',
      correctAnswersInPhase: 0,
      hoverCreditsAvailable: 7,
      hoverCreditsUsed: 0,
      setQuizData: vi.fn(),
      setSelectedAnswer: vi.fn(),
      setIsAnswered: vi.fn(),
      setRelevantTextRange: vi.fn(),
      generateText: vi.fn(),
      handleAnswerSelect: vi.fn(),
      submitFeedback: vi.fn(),
      resetQuizState: vi.fn(),
      resetQuizWithNewData: vi.fn(),
      setNextQuizAvailable: vi.fn(),
      loadNextQuiz: vi.fn(),
      fetchInitialPair: vi.fn(),
      useHoverCredit: vi.fn(),
      setQuizComplete: vi.fn(),
      goToNextQuestion: vi.fn(),
      submitAnswer: vi.fn(),
      setIsSubmitting: vi.fn(),
      setQuizStartTime: vi.fn(),
      setQuizEndTime: vi.fn(),
      handleWordSelection: vi.fn(),
      setTranslationLoading: vi.fn(),
      clearTranslation: vi.fn(),
      isSpeechSupported: false,
      isSpeakingPassage: false,
      isPaused: false,
      currentWordIndex: null,
      passageUtteranceRef: null,
      wordsRef: [],
      availableVoices: [],
      selectedVoiceURI: null,
      translationCache: new Map(),
      setVolumeLevel: vi.fn(),
      stopPassageSpeech: vi.fn(),
      handlePlayPause: vi.fn(),
      handleStop: vi.fn(),
      getTranslation: vi.fn(),
      speakText: vi.fn(),
      setIsSpeechSupported: vi.fn(),
      updateAvailableVoices: vi.fn(),
      setSelectedVoiceURI: vi.fn(),
      setAudioState: vi.fn(),
      togglePlayPause: vi.fn(),
      setPlaybackSpeed: vi.fn(),
      setCurrentSentenceIndex: vi.fn(),
      setVolume: vi.fn(),
      setSelectedVoice: vi.fn(),
      playPassageSpeech: vi.fn(),
      setPassageAudio: vi.fn(),
      setCurrentPassage: vi.fn(),
      language: 'en' as LearningLanguage,
      languages: UI_LANGUAGES,
      languageGuidingText: '',
      setLanguage: vi.fn(),
      setLanguageGuidingText: vi.fn(),
      feedback: {
        isCorrect: null,
        correctAnswer: null,
        correctExplanation: null,
        chosenIncorrectExplanation: null,
        relevantText: null,
      },
      hover: {
        progressionPhase: 'credits',
        correctAnswersInPhase: 0,
        creditsAvailable: 0,
        creditsUsed: 0,
      },
    }))
  );

describe('ProgressSlice', () => {
  let store: ReturnType<typeof setupStore>;
  const userId = 1;

  beforeEach(() => {
    vi.resetAllMocks();
    store = setupStore();
    // Ensure default language needed by get() in fetchProgress
    store.setState({ passageLanguage: 'en' });
  });

  it('should have correct initial state', () => {
    expect(store.getState().isProgressLoading).toBe(false);
    expect(store.getState().userStreak).toBeNull();
    expect(store.getState().error).toBeNull();
    expect(store.getState().showError).toBe(false);
  });

  it('should set loading state during fetch', () => {
    mockGetSession.mockResolvedValue({ user: { dbId: userId } });
    mockGetProgress.mockReturnValue(new Promise(() => {})); // Promise that never resolves

    // Call fetchProgress but don't await its completion
    void store.getState().fetchProgress();

    // Check loading state immediately after calling
    expect(store.getState().isProgressLoading).toBe(true);

    // No need to await or catch the promise here for this specific test
  });

  it('should fetch and set user streak and level successfully', async () => {
    const progressData: ProgressUpdateResult = {
      currentStreak: 10,
      currentLevel: 'B2',
      leveledUp: false,
      // error is optional, so undefined is fine here
    };
    mockGetSession.mockResolvedValue({ user: { dbId: userId } });
    mockGetProgress.mockResolvedValue(progressData);

    await store.getState().fetchProgress();

    expect(store.getState().isProgressLoading).toBe(false);
    expect(store.getState().userStreak).toBe(progressData.currentStreak);
    expect(store.getState().cefrLevel).toBe(progressData.currentLevel);
    expect(store.getState().error).toBeNull();
    expect(store.getState().showError).toBe(false);
  });

  it('should handle API error response (error property set)', async () => {
    const errorMessage = 'API failed';
    const progressData: ProgressUpdateResult = {
      error: errorMessage,
      currentLevel: 'A1', // Should still provide valid defaults
      currentStreak: 0,
      leveledUp: false,
    };
    mockGetSession.mockResolvedValue({ user: { dbId: userId } });
    mockGetProgress.mockResolvedValue(progressData);

    await store.getState().fetchProgress();

    // The slice logic currently throws the error, caught later
    expect(store.getState().isProgressLoading).toBe(false);
    // Expect error state to be set based on the thrown/caught error
    expect(store.getState().error).toBe(errorMessage);
    expect(store.getState().showError).toBe(true);
    expect(store.getState().userStreak).toBeNull(); // Should reset on error
  });

  it('should handle thrown error during fetch', async () => {
    const errorMessage = 'Fetch failed';
    mockGetSession.mockResolvedValue({ user: { dbId: userId } });
    mockGetProgress.mockRejectedValue(new Error(errorMessage));

    await store.getState().fetchProgress();

    expect(store.getState().isProgressLoading).toBe(false);
    expect(store.getState().userStreak).toBeNull();
    expect(store.getState().error).toBe(errorMessage);
    expect(store.getState().showError).toBe(true);
  });

  it('should do nothing if user is not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    store.setState({ userStreak: 5 }); // Pre-set value

    await store.getState().fetchProgress();

    expect(mockGetProgress).not.toHaveBeenCalled();
    expect(store.getState().isProgressLoading).toBe(false);
    expect(store.getState().userStreak).toBeNull(); // Should reset to null if no user
    expect(store.getState().error).toBeNull();
  });
});
