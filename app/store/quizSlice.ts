import type { StateCreator } from 'zustand';
import { submitAnswer, submitQuestionFeedback } from '@/app/actions/userProgress';
import { generateExerciseResponse } from '@/app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import { getSession } from 'next-auth/react';
import type { CEFRLevel } from '@/config/language-guidance';
import {} from '@/contexts/LanguageContext';
import {
  PartialQuizData,
  GenerateExerciseResultSchema,
  SubmitAnswerResultSchema,
} from '@/lib/domain/schemas';

interface NextQuizInfo {
  quizData: PartialQuizData;
  quizId: number;
}

export interface QuizSlice {
  quizData: PartialQuizData | null;
  currentQuizId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;
  feedbackIsCorrect: boolean | null;
  feedbackCorrectAnswer: string | null;
  feedbackExplanations: { A: string; B: string; C: string; D: string } | null;
  feedbackRelevantText: string | null;
  nextQuizAvailable: NextQuizInfo | null;
  feedbackSubmitted: boolean;

  setQuizData: (data: PartialQuizData | null) => void;
  setSelectedAnswer: (answer: string | null) => void;
  setIsAnswered: (answered: boolean) => void;
  setRelevantTextRange: (range: { start: number; end: number } | null) => void;
  setFeedback: (
    correct: boolean | null,
    correctAnswer: string | null,
    explanations: { A: string; B: string; C: string; D: string } | null,
    relevantText: string | null
  ) => void;
  generateText: (isPrefetch?: boolean) => Promise<void>;
  handleAnswerSelect: (answer: string) => Promise<void>;
  submitFeedback: (rating: 'good' | 'bad') => Promise<void>;
  resetQuizState: () => void;
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => void;
  _setNextQuizAvailable: (info: NextQuizInfo | null) => void;
  loadNextQuiz: () => void;
}

export const createQuizSlice: StateCreator<
  TextGeneratorState,
  [['zustand/immer', never]],
  [],
  QuizSlice
> = (set, get) => ({
  quizData: null,
  currentQuizId: null,
  selectedAnswer: null,
  isAnswered: false,
  relevantTextRange: null,
  feedbackIsCorrect: null,
  feedbackCorrectAnswer: null,
  feedbackExplanations: null,
  feedbackRelevantText: null,
  nextQuizAvailable: null,
  feedbackSubmitted: false,

  setQuizData: (data) =>
    set((state) => {
      state.quizData = data;
    }),
  setSelectedAnswer: (answer) =>
    set((state) => {
      state.selectedAnswer = answer;
    }),
  setIsAnswered: (answered) =>
    set((state) => {
      state.isAnswered = answered;
    }),
  setRelevantTextRange: (range) =>
    set((state) => {
      state.relevantTextRange = range;
    }),
  setFeedback: (correct, correctAnswer, explanations, relevantText) =>
    set((state) => {
      state.feedbackIsCorrect = correct;
      state.feedbackCorrectAnswer = correctAnswer;
      state.feedbackExplanations = explanations;
      state.feedbackRelevantText = relevantText;
    }),

  _setNextQuizAvailable: (info) =>
    set((state) => {
      state.nextQuizAvailable = info;
    }),

  resetQuizState: () => {
    set((state) => {
      state.quizData = null;
      state.currentQuizId = null;
      state.selectedAnswer = null;
      state.isAnswered = false;
      state.relevantTextRange = null;
      state.feedbackIsCorrect = null;
      state.feedbackCorrectAnswer = null;
      state.feedbackExplanations = null;
      state.feedbackRelevantText = null;
      state.showQuestionSection = false;
      state.showExplanation = false;
      state.nextQuizAvailable = null;
      state.feedbackSubmitted = false;
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
      state.feedbackExplanations = null;
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

      if (quizData && !quizData.language) {
        quizData.language = get().passageLanguage;
      }

      if (!quizData) {
        throw new Error('Failed to generate text. No quiz data received from API.');
      }

      if (isPrefetch) {
        get()._setNextQuizAvailable({
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
    const session = await getSession();
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

      type SessionUserWithDbId = { dbId?: number | string };

      const params: {
        id: number;
        ans: string;
        userId?: number | string;
        learn: string;
        lang: string;
        cefrLevel?: string;
      } = {
        id: currentQuizId,
        ans: answer,
        userId: (session?.user as SessionUserWithDbId)?.dbId,
        learn: passageLanguage,
        lang: generatedQuestionLanguage,
      };

      if (cefrLevel) {
        params.cefrLevel = cefrLevel;
      }

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
        state.feedbackExplanations = result.feedback?.explanations ?? null;
        state.feedbackRelevantText = result.feedback?.relevantText ?? null;

        if (state.quizData?.paragraph && result.feedback?.relevantText) {
          const paragraph = state.quizData.paragraph;
          const relevantText = result.feedback.relevantText;
          const startIndex = paragraph.indexOf(relevantText);
          if (startIndex !== -1) {
            const endIndex = startIndex + relevantText.length;
            state.relevantTextRange = { start: startIndex, end: endIndex };
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
      });
    } catch (error: unknown) {
      console.error('Error submitting answer:', String(error));
      set((state) => {
        state.feedbackIsCorrect = null;
        const message: string =
          error instanceof Error ? error.message : 'Unknown error submitting answer';
        state.error = `Failed to submit answer: ${message}. Please try again.`;
      });
    }
  },

  submitFeedback: async (rating): Promise<void> => {
    const { currentQuizId } = get();
    if (typeof currentQuizId !== 'number') {
      console.error('[SubmitFeedback] Invalid or missing quiz ID.');
      set((state) => {
        state.error = 'Cannot submit feedback: Invalid quiz ID.';
      });
      return;
    }

    try {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      const result = await submitQuestionFeedback({
        quizId: currentQuizId,
        rating: rating,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit feedback.');
      }

      console.log(
        `[SubmitFeedback] Feedback (${rating}) submitted successfully for quiz ${currentQuizId}.`
      );
      set((state) => {
        state.feedbackSubmitted = true;
        state.loading = false;
      });

      get().loadNextQuiz();
    } catch (error: unknown) {
      console.error('[SubmitFeedback] Error:', error);
      set((state) => {
        state.error = `Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`;
        state.loading = false;
      });
    }
  },
});
