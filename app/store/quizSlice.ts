import type { StateCreator } from 'zustand';
import { submitAnswer, submitFeedback } from 'app/actions/progress';
import {
  generateExerciseResponse,
  generateInitialExercisePair,
  getRandomGoodQuestionResponse,
} from 'app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from 'app/domain/language-guidance';
import {} from 'app/hooks/useLanguage';
import { z } from 'zod';
import {
  PartialQuizData,
  GenerateExerciseResultSchema,
  SubmitAnswerResultSchema,
  InitialExercisePairResultSchema,
} from 'app/domain/schemas';
import type { BaseSlice } from './baseSlice';
import { createBaseSlice } from './baseSlice';

interface NextQuizInfo {
  quizData: PartialQuizData;
  quizId: number;
}

export type HoverProgressionPhase = 'initial' | 'credits';

export interface QuizSlice extends BaseSlice {
  quizData: PartialQuizData | null;
  currentQuizId: number | null;
  lastShownQuizId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;
  feedback: {
    isCorrect: boolean | null;
    correctAnswer: string | null;
    correctExplanation: string | null;
    chosenIncorrectExplanation: string | null;
    relevantText: string | null;
  };
  nextQuizAvailable: NextQuizInfo | null;
  feedbackSubmitted: boolean;
  isSubmittingAnswer: boolean;
  isSubmittingFeedback: boolean;
  isPrefetching: boolean;
  hover: {
    progressionPhase: HoverProgressionPhase;
    correctAnswersInPhase: number;
    creditsAvailable: number;
    creditsUsed: number;
  };
  setQuizData: (data: PartialQuizData | null) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setIsAnswered: (answered: boolean) => void;
  setRelevantTextRange: (range: { start: number; end: number } | null) => void;
  generateText: (isPrefetch?: boolean) => Promise<void>;
  handleAnswerSelect: (answer: string) => Promise<void>;
  submitFeedback: (is_good: boolean) => Promise<void>;
  resetQuizState: () => void;
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => void;
  setNextQuizAvailable: (info: NextQuizInfo | null) => void;
  loadNextQuiz: () => void;
  fetchInitialPair: () => Promise<void>;
  fetchRandomGoodQuestion: () => Promise<void>;
  useHoverCredit: () => boolean;
}

const INITIAL_PHASE_THRESHOLD = 5;

export const INITIAL_HOVER_CREDITS = 7;

const getInitialQuizState = () => ({
  quizData: null,
  currentQuizId: null,
  lastShownQuizId: null,
  selectedAnswer: null,
  isAnswered: false,
  relevantTextRange: null,
  feedback: {
    isCorrect: null,
    correctAnswer: null,
    correctExplanation: null,
    chosenIncorrectExplanation: null,
    relevantText: null,
  },
  nextQuizAvailable: null,
  feedbackSubmitted: false,
  isSubmittingAnswer: false,
  isSubmittingFeedback: false,
  isPrefetching: false,
  hover: {
    progressionPhase: 'credits' as HoverProgressionPhase,
    correctAnswersInPhase: 0,
    creditsAvailable: INITIAL_HOVER_CREDITS,
    creditsUsed: 0,
  },
});

const resetFeedbackState = (state: QuizSlice) => {
  state.feedback.isCorrect = null;
  state.feedback.correctAnswer = null;
  state.feedback.correctExplanation = null;
  state.feedback.chosenIncorrectExplanation = null;
  state.feedback.relevantText = null;
};

const resetQuizCoreState = (state: QuizSlice) => {
  state.selectedAnswer = null;
  state.isAnswered = false;
  state.relevantTextRange = null;
  resetFeedbackState(state);
  state.nextQuizAvailable = null;
  state.feedbackSubmitted = false;
  state.isSubmittingAnswer = false;
  state.isSubmittingFeedback = false;
  state.isPrefetching = false;
  state.hover.creditsUsed = 0;
};

export const createQuizSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  QuizSlice
> = (set, get) => ({
  ...createBaseSlice(set),
  ...getInitialQuizState(),

  setQuizData: (data) => {
    set((state) => {
      state.quizData = data;
    });
  },
  setSelectedAnswer: (answer) => {
    set((state) => {
      state.selectedAnswer = answer;
    });
  },
  setIsAnswered: (answered) => {
    set((state) => {
      state.isAnswered = answered;
    });
  },
  setRelevantTextRange: (range) => {
    set((state) => {
      state.relevantTextRange = range;
    });
  },
  setNextQuizAvailable: (info) => {
    set((state) => {
      state.nextQuizAvailable = info;
    });
  },
  resetQuizState: () => {
    set((state) => {
      Object.assign(state, getInitialQuizState());
      get().setShowQuestionSection(false);
      get().setShowExplanation(false);
      get().setShowContent(false);
    });
  },
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => {
    console.log('[Quiz] Loading quiz ID:', quizId, 'Previous quiz ID:', get().lastShownQuizId);

    get().stopPassageSpeech();
    get().clearTranslationCache(); // Clear translations when loading new content
    get().resetQuizState();
    set((state) => {
      state.quizData = newQuizData;
      state.currentQuizId = quizId;
      state.lastShownQuizId = quizId; // Track the last shown quiz
      state.nextQuizAvailable = null; // Clear any stale prefetched quiz
      state.loading = false;
      state.error = null;
      const currentPassageLanguage = get().passageLanguage;
      state.generatedPassageLanguage = currentPassageLanguage;
    });
    get().setShowQuestionSection(true);
    get().setShowExplanation(false);
    get().setShowContent(true);

    // Prefetch the next quiz in the background for smooth transitions
    console.log('[Quiz] Starting prefetch for next quiz...');
    void get().generateText(true);
  },
  loadNextQuiz: () => {
    const nextQuiz = get().nextQuizAvailable;
    const lastShownId = get().lastShownQuizId;
    const currentQuizId = get().currentQuizId;

    console.log(
      '[Quiz] loadNextQuiz called. Next quiz available:',
      !!nextQuiz,
      'Next quiz ID:',
      nextQuiz?.quizId,
      'Last shown ID:',
      lastShownId,
      'Current quiz ID:',
      currentQuizId
    );

    if (nextQuiz) {
      // Check if the prefetched quiz is the same as the one we just showed OR currently showing
      if (nextQuiz.quizId === lastShownId || nextQuiz.quizId === currentQuizId) {
        console.warn(
          '[Quiz] Prefetched quiz is the same as last shown or current! Clearing it and generating new quiz.'
        );
        // Clear the duplicate prefetched quiz to prevent infinite loop
        set({ nextQuizAvailable: null });
        void get().generateText(); // Generate a fresh quiz instead
      } else {
        console.log('[Quiz] Using prefetched quiz:', nextQuiz.quizId);
        get().resetQuizWithNewData(nextQuiz.quizData, nextQuiz.quizId);
      }
    } else {
      console.log('[Quiz] No prefetched quiz available, generating new quiz...');
      void get().generateText();
    }
  },
  fetchInitialPair: async (): Promise<void> => {
    set({ loading: true, error: null });
    get().setShowContent(false);
    get().stopPassageSpeech();
    get().resetQuizState();
    try {
      const fetchParams = {
        passageLanguage: get().passageLanguage,
        questionLanguage: get().language, // Use user's UI language for questions
        cefrLevel: get().cefrLevel,
      };
      const rawResult = await generateInitialExercisePair(fetchParams);
      const parseResult = InitialExercisePairResultSchema.safeParse(rawResult);
      if (!parseResult.success) {
        console.error(
          '[Store] Zod validation error (fetchInitialPair):',
          z.treeifyError(parseResult.error)
        );
        throw new Error(`Invalid API response structure: ${parseResult.error.message}`);
      }
      const result = parseResult.data;
      if (result.error || result.quizzes.length !== 2)
        throw new Error(result.error || 'Invalid number of quizzes received');
      const [quizInfo1, quizInfo2] = result.quizzes;
      set((state) => {
        state.quizData = quizInfo1.quizData;
        state.currentQuizId = quizInfo1.quizId;
        state.generatedPassageLanguage = fetchParams.passageLanguage;
        state.feedbackSubmitted = false;
        state.hover.creditsUsed = 0;
        state.nextQuizAvailable = { quizData: quizInfo2.quizData, quizId: quizInfo2.quizId };
        state.loading = false;
        state.error = null;
      });
      get().setShowExplanation(false);
      get().setShowQuestionSection(true);
      get().setShowContent(true);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error fetching initial pair';
      get().setError(errorMessage);
      get().setShowContent(false);
      set({ loading: false, nextQuizAvailable: null });
    }
  },
  fetchRandomGoodQuestion: async (): Promise<void> => {
    set({ loading: true, error: null });
    get().setShowContent(false);
    get().stopPassageSpeech();
    get().resetQuizState();
    try {
      const fetchParams = {
        passageLanguage: get().passageLanguage,
        questionLanguage: get().language, // Use user's UI language for questions
        cefrLevel: get().cefrLevel,
      };
      console.log('[Store] Fetching random good question for initial load:', fetchParams);
      const response = await getRandomGoodQuestionResponse(fetchParams);

      if ('error' in response && response.error) {
        throw new Error(response.error);
      }

      const parseResult = GenerateExerciseResultSchema.safeParse(response as unknown);
      if (!parseResult.success) {
        console.error(
          '[Store] Zod validation error (fetchRandomGoodQuestion):',
          z.treeifyError(parseResult.error)
        );
        throw new Error(`Invalid API response structure: ${parseResult.error.message}`);
      }

      const validatedResponse = parseResult.data;
      const quizData: PartialQuizData = validatedResponse.quizData;
      const quizId = validatedResponse.quizId;

      if (!quizData.language) quizData.language = get().passageLanguage;

      console.log(
        '[Store] Loaded random good question with ID:',
        quizId,
        'cached:',
        validatedResponse.cached
      );

      set((state) => {
        state.quizData = quizData;
        state.currentQuizId = quizId;
        state.generatedPassageLanguage = fetchParams.passageLanguage;
        state.feedbackSubmitted = false;
        state.hover.creditsUsed = 0;
        state.loading = false;
        state.error = null;
      });

      get().setShowExplanation(false);
      get().setShowQuestionSection(true);
      get().setShowContent(true);

      // Prefetch the next quiz in the background for smooth transitions
      console.log('[Store] Starting prefetch for next quiz...');
      void get().generateText(true);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : 'Unknown error fetching random good question';
      console.error('[Store] Error in fetchRandomGoodQuestion:', errorMessage);
      get().setError(errorMessage);
      get().setShowContent(false);
      set({ loading: false });
    }
  },
  generateText: async (isPrefetch = false): Promise<void> => {
    const lastShownId = get().lastShownQuizId;
    console.log('[Quiz] generateText called. isPrefetch:', isPrefetch, 'lastShownId:', lastShownId);

    if (!isPrefetch && get().nextQuizAvailable) {
      console.log('[Quiz] Using loadNextQuiz flow (nextQuizAvailable exists)');
      get().loadNextQuiz();
      return;
    }
    set({ loading: !isPrefetch, error: null, isPrefetching: isPrefetch });
    if (!isPrefetch) {
      get().stopPassageSpeech();
      get().clearTranslationCache(); // Clear translations when generating new content
      set((state) => {
        resetQuizCoreState(state);
      });
      get().setShowExplanation(false);
    }
    try {
      console.log(
        '[Quiz] Calling generateExerciseResponse...',
        'excludeQuizId:',
        lastShownId || get().currentQuizId
      );
      const response = await generateExerciseResponse({
        passageLanguage: get().passageLanguage,
        questionLanguage: get().language, // Use user's UI language for questions
        cefrLevel: get().cefrLevel,
        excludeQuizId: lastShownId || get().currentQuizId,
      });
      if ('error' in response && response.error) {
        if (!isPrefetch) {
          get().setError(response.error);
          get().setShowContent(false);
          set({ loading: false });
        } else {
          set({ loading: false, nextQuizAvailable: null });
        }
        return;
      }
      const parseResult = GenerateExerciseResultSchema.safeParse(response as unknown);
      if (!parseResult.success) {
        const errorMsg = `Invalid API response structure: ${parseResult.error.message}`;
        if (!isPrefetch) {
          get().setError(errorMsg);
          get().setShowContent(false);
          set({ loading: false });
        } else {
          set({ loading: false, nextQuizAvailable: null });
        }
        return;
      }
      const validatedResponse = parseResult.data;
      const quizData: PartialQuizData = validatedResponse.quizData;
      const newQuizId = validatedResponse.quizId;

      if (!quizData.language) quizData.language = get().passageLanguage;

      console.log('[Quiz] Generated quiz ID:', newQuizId, 'isPrefetch:', isPrefetch);

      // Check if we accidentally got the same quiz as last shown
      if (newQuizId === lastShownId) {
        console.warn('[Quiz] WARNING: Generated quiz has same ID as last shown quiz!', newQuizId);
      }

      if (isPrefetch) {
        console.log('[Quiz] Storing prefetched quiz:', newQuizId);
        set({
          nextQuizAvailable: { quizData, quizId: newQuizId },
          loading: false,
          isPrefetching: false,
        });
      } else {
        console.log('[Quiz] Loading quiz immediately:', newQuizId);
        get().resetQuizWithNewData(quizData, newQuizId);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error during generation';
      if (!isPrefetch) {
        get().setError(errorMessage);
        get().setShowContent(false);
        set({ loading: false, isPrefetching: false });
      } else {
        set({ loading: false, nextQuizAvailable: null, isPrefetching: false });
      }
    }
  },
  handleAnswerSelect: async (answer): Promise<void> => {
    if (get().isAnswered || get().isSubmittingAnswer) return;

    set((state) => {
      state.selectedAnswer = answer;
      state.isAnswered = true;
      state.isSubmittingAnswer = true;
    });
    get().setShowExplanation(true);

    const quizId = get().currentQuizId;
    if (typeof quizId !== 'number') {
      set((state) => {
        state.isAnswered = false;
        state.selectedAnswer = null;
        state.isSubmittingAnswer = false;
      });
      get().setError('Cannot submit answer: Invalid quiz ID.');
      return;
    }
    try {
      const { passageLanguage, generatedQuestionLanguage, cefrLevel } = get();
      if (!generatedQuestionLanguage) throw new Error('Question language missing');
      const params = {
        id: quizId,
        ans: answer,
        learn: passageLanguage,
        lang: generatedQuestionLanguage,
        cefrLevel: cefrLevel,
      };
      const rawResult = await submitAnswer(params);
      const validatedResult = SubmitAnswerResultSchema.safeParse(rawResult as unknown);
      if (!validatedResult.success)
        throw new Error(`Invalid API response structure: ${validatedResult.error.message}`);
      const result = validatedResult.data;
      if (result.error) throw new Error(result.error);
      set((state) => {
        state.feedback.isCorrect = result.feedback?.isCorrect ?? null;
        state.feedback.correctAnswer = result.feedback?.correctAnswer ?? null;
        state.feedback.correctExplanation = result.feedback?.correctExplanation ?? null;
        state.feedback.chosenIncorrectExplanation =
          result.feedback?.chosenIncorrectExplanation ?? null;
        state.feedback.relevantText = result.feedback?.relevantText ?? null;
        if (state.quizData?.paragraph && result.feedback?.relevantText) {
          const paragraph = state.quizData.paragraph;
          const relevantText = result.feedback.relevantText;
          const startIndex = paragraph.indexOf(relevantText);
          if (startIndex !== -1) {
            state.relevantTextRange = {
              start: startIndex,
              end: startIndex + relevantText.length,
            };
          } else {
            state.relevantTextRange = null;
          }
        } else {
          state.relevantTextRange = null;
        }
        if (result.currentStreak !== undefined && result.currentStreak !== null) {
          state.userStreak = result.currentStreak;
        }
        if (result.leveledUp && result.currentLevel) {
          state.cefrLevel = result.currentLevel as CEFRLevel;
        }
        if (result.feedback?.isCorrect) {
          state.hover.correctAnswersInPhase += 1;
          if (
            state.hover.progressionPhase === 'initial' &&
            state.hover.correctAnswersInPhase >= INITIAL_PHASE_THRESHOLD
          ) {
            state.hover.progressionPhase = 'credits';
            state.hover.correctAnswersInPhase = 0;
          }
        } else if (state.hover.progressionPhase === 'initial') {
          state.hover.correctAnswersInPhase = 0;
        }
        state.isSubmittingAnswer = false;
      });
    } catch (error: unknown) {
      set((state) => {
        state.isSubmittingAnswer = false;
      });
      get().setError(error instanceof Error ? error.message : 'Failed to submit answer.');
    }
  },
  submitFeedback: async (isGood: boolean): Promise<void> => {
    const {
      currentQuizId,
      selectedAnswer,
      passageLanguage,
      generatedQuestionLanguage,
      cefrLevel,
    }: {
      currentQuizId: number | null;
      selectedAnswer: string | null;
      passageLanguage: string | null;
      generatedQuestionLanguage: string | null;
      cefrLevel: string | null;
    } = get();
    const feedbackIsCorrect = get().feedback.isCorrect;
    const quizId = currentQuizId;
    if (typeof quizId !== 'number') {
      get().setError('Cannot submit feedback: Invalid quiz ID.');
      set({ loading: false, feedbackSubmitted: false, isSubmittingFeedback: false });
      return;
    }
    if (!passageLanguage || !generatedQuestionLanguage || !cefrLevel) {
      get().setError(
        'Cannot submit feedback: Missing required state (language/level). Please refresh.'
      );
      set({ loading: false, feedbackSubmitted: false, isSubmittingFeedback: false });
      return;
    }
    get().setError(null);
    set({ loading: true, isSubmittingFeedback: true });
    try {
      const payload = {
        quizId: quizId,
        is_good: isGood ? 1 : 0,
        userAnswer: selectedAnswer ?? undefined,
        isCorrect: feedbackIsCorrect ?? undefined,
        passageLanguage,
        questionLanguage: generatedQuestionLanguage, // Use the generated question language
        currentLevel: cefrLevel,
      };
      const result = await submitFeedback(payload);
      if (!result.success) {
        const errorMessage = result.error || 'Failed to submit feedback via API.';
        throw new Error(errorMessage);
      }
      set({ feedbackSubmitted: true, loading: false, isSubmittingFeedback: false });
      const nextQuiz = get().nextQuizAvailable;
      if (nextQuiz) {
        get().resetQuizWithNewData(nextQuiz.quizData, nextQuiz.quizId);
      } else {
        try {
          await get().generateText();
        } catch (genError) {
          get().setError(
            genError instanceof Error ? genError.message : 'Failed to generate next exercise.'
          );
          get().setShowContent(false);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      get().setError(`Failed to submit feedback: ${message}`);
      set({ loading: false, feedbackSubmitted: false, isSubmittingFeedback: false });
    }
  },
  useHoverCredit: () => {
    const currentCredits = get().hover.creditsAvailable;
    if (currentCredits > 0) {
      set((state) => {
        state.hover.creditsAvailable -= 1;
        state.hover.creditsUsed += 1;
      });
      return true;
    }
    return false;
  },
});
