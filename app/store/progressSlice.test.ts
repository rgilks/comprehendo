import { describe, it, expect, vi, beforeEach } from 'vitest';
import { create, type StoreApi } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createBaseSlice } from './baseSlice';

// Use vi.hoisted for mock variables to ensure they are available
const { mockGetSession, mockGetProgress } = vi.hoisted(() => {
  return {
    mockGetSession: vi.fn(),
    mockGetProgress: vi.fn(),
  };
});

vi.mock('next-auth/react', () => ({
  getSession: mockGetSession,
}));
vi.mock('@/app/actions/progress', () => ({
  getProgress: mockGetProgress,
}));

// Now import the module under test and other dependencies
import { createProgressSlice } from './progressSlice';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from '@/lib/domain/language-guidance';
import type { GetProgressResult } from '@/lib/domain/progress';

// Helper to create a store instance for testing
const createTestStore = (
  initialState: Partial<TextGeneratorState> = {}
): StoreApi<TextGeneratorState> => {
  return create<TextGeneratorState>()(
    immer((set, get, api) => {
      // Create the slices we need parts of
      const baseSlice = createBaseSlice<TextGeneratorState>(set);
      const progressSlice = createProgressSlice(set, get, api);

      // Define the minimal required state structure for these tests
      const minimalState: Partial<TextGeneratorState> = {
        // --- State used/modified by ProgressSlice & its dependencies ---
        // From BaseSlice (state)
        loading: baseSlice.loading,
        error: baseSlice.error,
        showError: baseSlice.showError,
        // From ProgressSlice (state)
        isProgressLoading: progressSlice.isProgressLoading,
        userStreak: progressSlice.userStreak,
        // From SettingsSlice (state needed by fetchProgress)
        passageLanguage: 'en', // Default needed for get()
        cefrLevel: 'A1', // Default needed & modified by fetchProgress

        // --- Methods used/modified by ProgressSlice ---
        // From BaseSlice (methods)
        setLoading: baseSlice.setLoading,
        setError: baseSlice.setError,
        // From ProgressSlice (methods)
        fetchProgress: progressSlice.fetchProgress,

        // --- Mocks for potentially called methods from other slices ---
        setCefrLevel: vi.fn(), // Mocked as ProgressSlice calls this via set()
        // Add mocks for any other methods potentially called via get() if necessary
        // e.g., get().stopPassageSpeech() - Check if progressSlice calls it.
        stopPassageSpeech: vi.fn(), // Assuming progressSlice *might* call this via get()

        // Add any other essential properties for type compatibility if needed
        // These might come from UISlice, QuizSlice, etc.
        // Let's start minimal and add based on TS errors.
        showLoginPrompt: false,
        showContent: false,
        showQuestionSection: false,
        showExplanation: false,
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
        isSpeechSupported: false,
        isSpeakingPassage: false,
        isPaused: false,
        volume: 0.5,
        currentWordIndex: null,
        passageUtteranceRef: null,
        wordsRef: [],
        availableVoices: [],
        selectedVoiceURI: null,
        translationCache: new Map(),
        generatedPassageLanguage: null,
        generatedQuestionLanguage: null,
        language: 'en',
      };

      // Merge minimal state with test-specific overrides
      const finalInitialState: TextGeneratorState = {
        ...(minimalState as TextGeneratorState), // Cast needed as we start partial
        ...(initialState as TextGeneratorState), // Apply test-specific overrides last
      };

      return finalInitialState;
    })
  );
};

describe('ProgressSlice', () => {
  let store: StoreApi<TextGeneratorState>;

  beforeEach(() => {
    vi.resetAllMocks();
    store = createTestStore(); // Create a fresh store for each test
  });

  it('should have correct initial state', () => {
    const { isProgressLoading, userStreak } = store.getState();
    expect(isProgressLoading).toBe(false);
    expect(userStreak).toBeNull();
  });

  describe('fetchProgress', () => {
    const userId = 123;
    const language = 'en';

    beforeEach(() => {
      store.setState({ passageLanguage: language });
    });

    it('should set loading state correctly', async () => {
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue({ streak: 5, currentLevel: 'B1' });

      const promise = store.getState().fetchProgress();
      expect(store.getState().isProgressLoading).toBe(true);
      await promise;
      expect(store.getState().isProgressLoading).toBe(false);
    });

    it('should reset streak and set loading to false if no session/userId', async () => {
      mockGetSession.mockResolvedValue(null);
      store.setState({ userStreak: 5 }); // Set a pre-existing streak

      await store.getState().fetchProgress();

      const { isProgressLoading, userStreak } = store.getState();
      expect(isProgressLoading).toBe(false);
      expect(userStreak).toBeNull();
      expect(mockGetProgress).not.toHaveBeenCalled();
    });

    it('should fetch and set user streak and level successfully', async () => {
      const progressData: GetProgressResult = { streak: 10, currentLevel: 'B2', error: null };
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue(progressData);

      await store.getState().fetchProgress();

      const { userStreak, cefrLevel, isProgressLoading, error } = store.getState();
      expect(isProgressLoading).toBe(false);
      expect(userStreak).toBe(progressData.streak);
      expect(cefrLevel).toBe(progressData.currentLevel);
      expect(error).toBeNull();
      expect(mockGetProgress).toHaveBeenCalledWith({ language });
    });

    it('should set streak to 0 if API returns null/undefined streak', async () => {
      const progressData: GetProgressResult = { streak: null, currentLevel: 'A2', error: null };
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue(progressData);

      await store.getState().fetchProgress();

      const { userStreak, cefrLevel } = store.getState();
      expect(userStreak).toBe(0);
      expect(cefrLevel).toBe('A2');
    });

    it('should not update level if API returns null/undefined level', async () => {
      const initialLevel: CEFRLevel = 'C1';
      store.setState({ cefrLevel: initialLevel });
      const progressData: GetProgressResult = { streak: 3, currentLevel: null, error: null };
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue(progressData);

      await store.getState().fetchProgress();

      const { userStreak, cefrLevel } = store.getState();
      expect(userStreak).toBe(3);
      expect(cefrLevel).toBe(initialLevel); // Level should remain unchanged
    });

    it('should handle API error response', async () => {
      const errorMessage = 'API failed';
      const progressData: GetProgressResult = { error: errorMessage }; // Schema allows error only
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue(progressData);

      await store.getState().fetchProgress();

      const { userStreak, isProgressLoading, error, showError } = store.getState();
      expect(isProgressLoading).toBe(false);
      expect(userStreak).toBeNull(); // Streak should be null on error
      expect(error).toBe(errorMessage);
      expect(showError).toBe(true);
    });

    it('should handle validation error (invalid API response structure)', async () => {
      const invalidProgressData = { score: 100 }; // Doesn't match schema
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockResolvedValue(invalidProgressData as any);

      await store.getState().fetchProgress();

      const { userStreak, isProgressLoading, error, showError } = store.getState();
      expect(isProgressLoading).toBe(false);
      expect(userStreak).toBe(0);
      expect(error).toBeNull();
      expect(showError).toBe(false);
    });

    it('should handle thrown error during getProgress call', async () => {
      const errorMessage = 'Network Error';
      mockGetSession.mockResolvedValue({ user: { dbId: userId } } as any);
      mockGetProgress.mockRejectedValue(new Error(errorMessage));

      await store.getState().fetchProgress();

      const { userStreak, isProgressLoading, error, showError } = store.getState();
      expect(isProgressLoading).toBe(false);
      expect(userStreak).toBeNull();
      expect(error).toBe(errorMessage);
      expect(showError).toBe(true);
    });
  });
});
