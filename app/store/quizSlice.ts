import type { StateCreator } from 'zustand';
import { submitAnswer, submitQuestionFeedback } from '@/app/actions/userProgress';
import { generateExerciseResponse } from '@/app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import type { CEFRLevel } from '@/lib/domain/language-guidance';
import {} from '@/hooks/useLanguage';
import {
  PartialQuizData,
  GenerateExerciseResultSchema,
  SubmitAnswerResultSchema,
} from '@/lib/domain/schemas';
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
  feedbackIsCorrect: boolean | null;
  feedbackCorrectAnswer: string | null;
  feedbackCorrectExplanation: string | null;
  feedbackChosenIncorrectExplanation: string | null;
  feedbackRelevantText: string | null;
  nextQuizAvailable: NextQuizInfo | null;
  feedbackSubmitted: boolean;

  hoverProgressionPhase: HoverProgressionPhase;
  correctAnswersInPhase: number;
  hoverCreditsAvailable: number;
  hoverCreditsUsed: number;

  setQuizData: (data: PartialQuizData | null) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setIsAnswered: (answered: boolean) => void;
  setRelevantTextRange: (range: { start: number; end: number } | null) => void;
  setFeedback: (
    correct: boolean | null,
    correctAnswer: string | null,
    correctExplanation: string | null,
    chosenIncorrectExplanation: string | null,
    relevantText: string | null
  ) => void;
  generateText: (isPrefetch?: boolean) => Promise<void>;
  handleAnswerSelect: (answer: string) => Promise<void>;
  submitFeedback: (is_good: boolean) => Promise<void>;
  resetQuizState: () => void;
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => void;
  setNextQuizAvailable: (info: NextQuizInfo | null) => void;
  loadNextQuiz: () => void;

  useHoverCredit: () => boolean;
}

const INITIAL_HOVER_CREDITS = 7;
const INITIAL_PHASE_THRESHOLD = 5;

export const createQuizSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  QuizSlice
> = (set, get) => ({
  ...createBaseSlice(set),
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
  hoverCreditsAvailable: INITIAL_HOVER_CREDITS,
  hoverCreditsUsed: 0,

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
  setFeedback: (
    correct,
    correctAnswer,
    correctExplanation,
    chosenIncorrectExplanation,
    relevantText
  ) => {
    set((state) => {
      state.feedbackIsCorrect = correct;
      state.feedbackCorrectAnswer = correctAnswer;
      state.feedbackCorrectExplanation = correctExplanation;
      state.feedbackChosenIncorrectExplanation = chosenIncorrectExplanation;
      state.feedbackRelevantText = relevantText;
    });
  },

  setNextQuizAvailable: (info) => {
    set((state) => {
      state.nextQuizAvailable = info;
    });
  },

  resetQuizState: () => {
    set((state) => {
      state.quizData = null;
      state.currentQuizId = null;
      state.selectedAnswer = null;
      state.isAnswered = false;
      state.relevantTextRange = null;
      state.feedbackIsCorrect = null;
      state.feedbackCorrectAnswer = null;
      state.feedbackCorrectExplanation = null;
      state.feedbackChosenIncorrectExplanation = null;
      state.feedbackRelevantText = null;
      state.showQuestionSection = false;
      state.showExplanation = false;
      state.nextQuizAvailable = null;
      state.feedbackSubmitted = false;
      state.hoverCreditsAvailable =
        get().hoverProgressionPhase === 'initial' ? Infinity : INITIAL_HOVER_CREDITS;
      state.hoverCreditsUsed = 0;
    });
  },

  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => {
    get().stopPassageSpeech();
    set((state) => {
      state.quizData = newQuizData;
      state.currentQuizId = quizId;
      state.selectedAnswer = null;
      state.isAnswered = false;
      state.relevantTextRange = null;
      state.feedbackIsCorrect = null;
      state.feedbackCorrectAnswer = null;
      state.feedbackCorrectExplanation = null;
      state.feedbackChosenIncorrectExplanation = null;
      state.feedbackRelevantText = null;
      state.showQuestionSection = true;
      state.showExplanation = false;
      state.showContent = true;
      state.loading = false;
      state.error = null;
      const currentPassageLanguage = get().passageLanguage;
      state.generatedPassageLanguage = currentPassageLanguage;
      state.nextQuizAvailable = null;
      state.feedbackSubmitted = false;

      const currentPhase = state.hoverProgressionPhase;
      state.hoverCreditsAvailable = currentPhase === 'initial' ? Infinity : INITIAL_HOVER_CREDITS;
      state.hoverCreditsUsed = 0;
    });

    void get().generateText(true);
  },

  loadNextQuiz: () => {
    const nextQuiz = get().nextQuizAvailable;
    if (nextQuiz) {
      get().resetQuizWithNewData(nextQuiz.quizData, nextQuiz.quizId);
    } else {
      console.warn('Next quiz not available, generating new one.');
      void get().generateText();
    }
  },

  generateText: async (isPrefetch = false): Promise<void> => {
    if (!isPrefetch) {
      get().setLoading(true);
      get().setError(null);
      get().stopPassageSpeech();
      get().resetQuizState();
      get().setShowContent(false);
    }

    try {
      const { passageLanguage, cefrLevel, generatedQuestionLanguage } = get();

      const params = {
        passageLanguage: passageLanguage,
        questionLanguage: generatedQuestionLanguage ?? 'en',
        cefrLevel: cefrLevel,
      };

      const rawResponse = await generateExerciseResponse(params);

      const validatedResponse = GenerateExerciseResultSchema.safeParse(rawResponse as unknown);

      if (!validatedResponse.success) {
        console.error('Zod validation error (generateExercise):', validatedResponse.error.message);
        throw new Error(`Invalid API response structure: ${validatedResponse.error.message}`);
      }

      const response = validatedResponse.data;

      if (response.error) {
        throw new Error(response.error);
      }

      const quizData: PartialQuizData | null = response.quizData;

      if (!quizData.language) {
        quizData.language = get().passageLanguage;
      }

      if (isPrefetch) {
        get().setNextQuizAvailable({
          quizData: quizData,
          quizId: response.quizId,
        });
        console.log('Next quiz pre-fetched.');
      } else {
        get().resetQuizWithNewData(quizData, response.quizId);
      }
    } catch (error: unknown) {
      console.error('Error generating text:', String(error));
      if (!isPrefetch) {
        const message: string =
          error instanceof Error ? error.message : 'An unknown error occurred';
        get().setError(message);
        get().setLoading(false);
        get().setShowContent(false);
      }
    } finally {
      if (!isPrefetch) {
        get().setLoading(false);
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
    const { currentQuizId } = get();

    if (typeof currentQuizId !== 'number') {
      console.error('Invalid or missing current quiz ID:', currentQuizId);
      set((state) => {
        state.error = 'Cannot submit answer: Invalid quiz ID.';
        state.isAnswered = false;
        state.selectedAnswer = null;
      });
      return;
    }

    try {
      const { passageLanguage, generatedQuestionLanguage, cefrLevel } = get();

      if (!generatedQuestionLanguage) {
        console.error('Cannot submit answer: Question language not set in state.');
        throw new Error('Question language missing');
      }

      const params: {
        id?: number;
        ans?: string;
        learn: string;
        lang: string;
        cefrLevel?: string;
      } = {
        id: currentQuizId,
        ans: answer,
        learn: passageLanguage,
        lang: generatedQuestionLanguage,
        cefrLevel: cefrLevel,
      };

      const rawResult = await submitAnswer(params);

      const validatedResult = SubmitAnswerResultSchema.safeParse(rawResult as unknown);

      if (!validatedResult.success) {
        console.error('Zod validation error (submitAnswer):', validatedResult.error.message);
        throw new Error(`Invalid API response structure: ${validatedResult.error.message}`);
      }

      const result = validatedResult.data;

      if (result.error) {
        throw new Error(result.error);
      }

      set((state) => {
        state.feedbackIsCorrect = result.feedback?.isCorrect ?? null;
        state.feedbackCorrectAnswer = result.feedback?.correctAnswer ?? null;
        state.feedbackCorrectExplanation = result.feedback?.correctExplanation ?? null;
        state.feedbackChosenIncorrectExplanation =
          result.feedback?.chosenIncorrectExplanation ?? null;
        state.feedbackRelevantText = result.feedback?.relevantText ?? null;

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
          state.correctAnswersInPhase += 1;
          if (
            state.hoverProgressionPhase === 'initial' &&
            state.correctAnswersInPhase >= INITIAL_PHASE_THRESHOLD
          ) {
            state.hoverProgressionPhase = 'credits';
            state.correctAnswersInPhase = 0;
            console.log('Transitioning to hover credits phase!');
          }
        } else {
          if (state.hoverProgressionPhase === 'initial') {
            state.correctAnswersInPhase = 0;
          }
        }
      });
    } catch (error: unknown) {
      console.error('Error submitting answer:', error);
      set((state) => {
        state.error = error instanceof Error ? error.message : 'Failed to submit answer.';
      });
    }
  },

  submitFeedback: async (is_good: boolean): Promise<void> => {
    const {
      currentQuizId,
      selectedAnswer,
      feedbackIsCorrect,
      passageLanguage,
      generatedQuestionLanguage,
      cefrLevel,
    } = get();

    if (typeof currentQuizId !== 'number') {
      console.error('[SubmitFeedback][Store] Invalid or missing quiz ID.');
      set((state) => {
        state.error = 'Cannot submit feedback: Invalid quiz ID.';
      });
      return;
    }

    if (!generatedQuestionLanguage) {
      console.error(
        '[SubmitFeedback][Store] Missing language/level state required for fetching next question.',
        { passageLanguage, generatedQuestionLanguage, cefrLevel }
      );
      set((state) => {
        state.error =
          'Cannot submit feedback: Missing required state (language/level). Please refresh.';
      });
      return;
    }

    try {
      set((state) => {
        state.loading = true;
        state.error = null;
        state.feedbackSubmitted = false;
      });

      const userAnswer = selectedAnswer;
      const isCorrect = feedbackIsCorrect;

      const params = {
        quizId: currentQuizId,
        is_good: is_good ? 1 : 0,
        userAnswer: userAnswer ?? undefined,
        isCorrect: isCorrect ?? undefined,
        passageLanguage: passageLanguage,
        questionLanguage: generatedQuestionLanguage,
        currentLevel: cefrLevel,
      };

      const result = await submitQuestionFeedback(params);

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit feedback via API.');
      }

      console.log(
        `[SubmitFeedback][Store] Feedback (${is_good}) submitted successfully for quiz ${currentQuizId}.`
      );

      set((state) => {
        state.feedbackSubmitted = true;
      });

      const nextQuiz = get().nextQuizAvailable;
      if (nextQuiz) {
        console.log(
          `[SubmitFeedback][Store] Prefetched quiz data found (ID: ${nextQuiz.quizId}). Loading immediately...`
        );
        get().resetQuizWithNewData(nextQuiz.quizData, nextQuiz.quizId);
      } else {
        console.warn(
          `[SubmitFeedback][Store] Feedback saved, but no prefetched quiz was available to display.`
        );
        set((state) => {
          state.loading = false;
        });
      }
    } catch (error: unknown) {
      console.error('[SubmitFeedback][Store] Error during feedback submission process:', error);
      set((state) => {
        state.error = `Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`;
        state.loading = false;
        state.feedbackSubmitted = false;
      });
    }
  },

  useHoverCredit: () => {
    const currentCredits = get().hoverCreditsAvailable;
    if (currentCredits > 0) {
      set((state) => {
        if (state.hoverCreditsAvailable > 0) {
          state.hoverCreditsAvailable -= 1;
          state.hoverCreditsUsed += 1;
        }
      });
      return true;
    }
    return false;
  },
});
