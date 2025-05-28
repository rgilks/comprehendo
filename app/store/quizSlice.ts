import type { StateCreator } from 'zustand';
import { submitAnswer, submitFeedback } from 'app/actions/progress';
import { generateExerciseResponse, generateInitialExercisePair } from 'app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from 'app/domain/language-guidance';
import {} from 'app/hooks/useLanguage';
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
  hover: {
    progressionPhase: HoverProgressionPhase;
    correctAnswersInPhase: number;
    creditsAvailable: number;
    creditsUsed: number;
  };
  showQuestionSection: boolean;
  showExplanation: boolean;
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
  useHoverCredit: () => boolean;
}

const INITIAL_PHASE_THRESHOLD = 5;

export const INITIAL_HOVER_CREDITS = 7;

const getInitialQuizState = () => ({
  quizData: null,
  currentQuizId: null,
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
  hover: {
    progressionPhase: 'credits' as HoverProgressionPhase,
    correctAnswersInPhase: 0,
    creditsAvailable: INITIAL_HOVER_CREDITS,
    creditsUsed: 0,
  },
  showQuestionSection: false,
  showExplanation: false,
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
  state.showExplanation = false;
  state.nextQuizAvailable = null;
  state.feedbackSubmitted = false;
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
    });
  },
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => {
    get().stopPassageSpeech();
    get().resetQuizState();
    set((state) => {
      state.quizData = newQuizData;
      state.currentQuizId = quizId;
      state.showQuestionSection = true;
      state.showExplanation = false;
      state.showContent = true;
      state.loading = false;
      state.error = null;
      const currentPassageLanguage = get().passageLanguage;
      state.generatedPassageLanguage = currentPassageLanguage;
    });
    void get().generateText(true);
  },
  loadNextQuiz: () => {
    const nextQuiz = get().nextQuizAvailable;
    if (nextQuiz) {
      get().resetQuizWithNewData(nextQuiz.quizData, nextQuiz.quizId);
    } else {
      void get().generateText();
    }
  },
  fetchInitialPair: async (): Promise<void> => {
    set({ loading: true, error: null, showContent: false });
    get().stopPassageSpeech();
    get().resetQuizState();
    try {
      const fetchParams = {
        passageLanguage: get().passageLanguage,
        questionLanguage: get().generatedQuestionLanguage,
        cefrLevel: get().cefrLevel,
      };
      const rawResult = await generateInitialExercisePair(fetchParams);
      const parseResult = InitialExercisePairResultSchema.safeParse(rawResult);
      if (!parseResult.success) {
        console.error(
          '[Store] Zod validation error (fetchInitialPair):',
          parseResult.error.format()
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
        resetQuizCoreState(state);
        state.showExplanation = false;
        state.feedbackSubmitted = false;
        state.hover.creditsUsed = 0;
        state.nextQuizAvailable = { quizData: quizInfo2.quizData, quizId: quizInfo2.quizId };
        state.showQuestionSection = true;
        state.showContent = true;
        state.loading = false;
        state.error = null;
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error fetching initial pair';
      get().setError(errorMessage);
      get().setShowContent(false);
      set({ loading: false, nextQuizAvailable: null });
    }
  },
  generateText: async (isPrefetch = false): Promise<void> => {
    if (!isPrefetch && get().nextQuizAvailable) {
      get().loadNextQuiz();
      return;
    }
    set({ loading: !isPrefetch, error: null });
    if (!isPrefetch) {
      get().stopPassageSpeech();
      set((state) => {
        resetQuizCoreState(state);
      });
    }
    try {
      const response = await generateExerciseResponse({
        passageLanguage: get().passageLanguage,
        questionLanguage: get().generatedQuestionLanguage,
        cefrLevel: get().cefrLevel,
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
      if (!quizData.language) quizData.language = get().passageLanguage;
      if (isPrefetch) {
        set({ nextQuizAvailable: { quizData, quizId: validatedResponse.quizId }, loading: false });
      } else {
        get().resetQuizWithNewData(quizData, validatedResponse.quizId);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error during generation';
      if (!isPrefetch) {
        get().setError(errorMessage);
        get().setShowContent(false);
        set({ loading: false });
      } else {
        set({ loading: false, nextQuizAvailable: null });
      }
    }
  },
  handleAnswerSelect: async (answer): Promise<void> => {
    if (get().isAnswered) return;
    set((state) => {
      state.selectedAnswer = answer;
      state.isAnswered = true;
      state.showExplanation = true;
    });
    const quizId = get().currentQuizId;
    if (typeof quizId !== 'number') {
      set((state) => {
        state.error = 'Cannot submit answer: Invalid quiz ID.';
        state.isAnswered = false;
        state.selectedAnswer = null;
      });
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
      });
    } catch (error: unknown) {
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to submit answer.';
      });
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
      set({
        error: 'Cannot submit feedback: Invalid quiz ID.',
        loading: false,
        feedbackSubmitted: false,
      });
      return;
    }
    if (!passageLanguage || !generatedQuestionLanguage || !cefrLevel) {
      set({
        error: 'Cannot submit feedback: Missing required state (language/level). Please refresh.',
        loading: false,
        feedbackSubmitted: false,
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const payload = {
        quizId: quizId,
        is_good: isGood ? 1 : 0,
        userAnswer: selectedAnswer ?? undefined,
        isCorrect: feedbackIsCorrect ?? undefined,
        passageLanguage,
        questionLanguage: generatedQuestionLanguage,
        currentLevel: cefrLevel,
      };
      const result = await submitFeedback(payload);
      if (!result.success) {
        const errorMessage = result.error || 'Failed to submit feedback via API.';
        throw new Error(errorMessage);
      }
      set({ feedbackSubmitted: true, loading: false });
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
      set({
        error: `Failed to submit feedback: ${message}`,
        loading: false,
        feedbackSubmitted: false,
      });
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
