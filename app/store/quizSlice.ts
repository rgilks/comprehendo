import type { StateCreator } from 'zustand';
// Removed unused Zod import
// import { z } from 'zod';
// import type { PartialQuizData } from '@/app/actions/exercise';
import { submitAnswer, submitQuestionFeedback } from '@/app/actions/userProgress';
import { generateExerciseResponse } from '@/app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import { getSession } from 'next-auth/react';
import type { CEFRLevel } from '@/config/language-guidance'; // Keep CEFRLevel if used elsewhere in file
import {} from '@/contexts/LanguageContext'; // Removed unused Language type and LANGUAGES map
import {
  // QuizData, // Keep full QuizData if needed for feedback part, otherwise remove
  PartialQuizData, // Use PartialQuizData
  GenerateExerciseResultSchema,
  SubmitAnswerResultSchema,
} from '@/lib/domain/schemas'; // <-- Import centralized types/schemas

// Define QuizData type used within the store - Now using PartialQuizData mainly
// type QuizData = PartialQuizData; // Now imported

// --- Zod Schemas --- START
// REMOVED QuizDataSchema definition
// REMOVED export type QuizData = z.infer<typeof QuizDataSchema>;
// REMOVED GenerateExerciseResultSchema definition
// REMOVED SubmitAnswerResultSchema definition
// --- Zod Schemas --- END

// Define the shape of the pre-fetched quiz data
interface NextQuizInfo {
  quizData: PartialQuizData;
  quizId: number;
}

// interface FeedbackResponse { // Removed unused type
//   feedback: { // Removed unused type
//     isCorrect: boolean; // Removed unused type
//     correctAnswer: string; // Removed unused type
//     explanations: Record<string, string>; // Removed unused type
//     relevantText: string; // Removed unused type
//   } | null; // Removed unused type
//   currentStreak: number | null; // Removed unused type
//   leveledUp: boolean | null; // Removed unused type
//   currentLevel: CEFRLevel | null; // Removed unused type
// } // Removed unused type

export interface QuizSlice {
  quizData: PartialQuizData | null;
  currentQuizId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;
  // Feedback still likely uses full details, keep original structure if SubmitAnswerResult provides it
  feedbackIsCorrect: boolean | null;
  feedbackCorrectAnswer: string | null;
  feedbackExplanations: { A: string; B: string; C: string; D: string } | null;
  feedbackRelevantText: string | null;
  nextQuizAvailable: NextQuizInfo | null; // Uses PartialQuizData via NextQuizInfo
  feedbackSubmitted: boolean; // <-- NEW: Track if feedback was given for the current question

  setQuizData: (data: PartialQuizData | null) => void; // Use PartialQuizData
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
  submitFeedback: (rating: 'good' | 'bad') => Promise<void>; // <-- NEW: Action to submit feedback
  resetQuizState: () => void;
  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => void; // Use PartialQuizData
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
  feedbackSubmitted: false, // <-- NEW: Initial state

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
      state.nextQuizAvailable = null; // Clear prefetched quiz
      state.feedbackSubmitted = false; // <-- NEW: Reset feedback submitted state
    });
  },

  resetQuizWithNewData: (newQuizData: PartialQuizData, quizId: number) => {
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
      state.showQuestionSection = true; // Show question immediately
      state.showExplanation = false;
      state.showContent = true;
      state.loading = false;
      state.error = null;
      const currentPassageLanguage = get().passageLanguage;
      state.generatedPassageLanguage = currentPassageLanguage;
      state.nextQuizAvailable = null;
      state.feedbackSubmitted = false; // <-- NEW: Reset feedback submitted state
    });

    // No longer need timeout logic
    // get().clearQuestionDelayTimeout();
    // const timeoutId = setTimeout(() => get().setShowQuestionSection(true), 1000);
    // get().setQuestionDelayTimeoutRef(timeoutId);

    // Prefetch next quiz immediately after showing the current one
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
      // get().clearQuestionDelayTimeout(); // No longer needed
      get().resetQuizState();
      get().setShowContent(false);
    }

    try {
      const { passageLanguage, cefrLevel, generatedQuestionLanguage } = get();

      // Construct the params object
      const params = {
        passageLanguage: passageLanguage,
        questionLanguage: generatedQuestionLanguage ?? 'en', // Use UI language or default
        cefrLevel: cefrLevel,
      };

      // Pass the params object to the action
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

      // The response.quizData ALREADY contains the PartialQuizData object
      // No need to parse response.result anymore.
      const quizData: PartialQuizData | null = response.quizData;

      // Add language if missing (assuming PartialQuizData might have it optional)
      if (quizData && !quizData.language) {
        quizData.language = get().passageLanguage;
      }

      // Now check the received quizData (which is PartialQuizData)
      if (!quizData) {
        throw new Error('Failed to generate text. No quiz data received from API.');
      }

      // Use received quizData (PartialQuizData) and response.quizId
      if (isPrefetch) {
        get()._setNextQuizAvailable({
          quizData: quizData, // Use PartialQuizData
          quizId: response.quizId,
        });
        console.log('Next quiz pre-fetched.');
      } else {
        get().resetQuizWithNewData(quizData, response.quizId); // Use PartialQuizData
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

      // Define expected User type part for session
      type SessionUserWithDbId = { dbId?: number | string };

      // Construct the params object correctly
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

      // Add cefrLevel conditionally
      if (cefrLevel) {
        params.cefrLevel = cefrLevel;
      }

      const rawResult = await submitAnswer(params);

      const validatedResult = SubmitAnswerResultSchema.safeParse(rawResult as unknown);

      if (!validatedResult.success) {
        // Access .message
        console.error('Zod validation error (submitAnswer):', validatedResult.error.message);
        throw new Error(`Invalid API response structure: ${validatedResult.error.message}`);
      }

      const result = validatedResult.data; // Use validated data
      // console.log('[QuizSlice handleAnswerSelect] API Result:', result); // Log the API result

      if (result.error) {
        throw new Error(result.error);
      }

      set((state) => {
        // console.log('[QuizSlice handleAnswerSelect] Setting feedback state:', {
        //   // Log state being set (accessing via result.feedback)
        //   isCorrect: result.feedback?.isCorrect ?? null,
        //   correctAnswer: result.feedback?.correctAnswer ?? null,
        //   explanations: result.feedback?.explanations ?? null,
        //   relevantText: result.feedback?.relevantText ?? null,
        //   streak: result.currentStreak,
        //   leveledUp: result.leveledUp,
        //   currentLevel: result.currentLevel,
        // });
        state.feedbackIsCorrect = result.feedback?.isCorrect ?? null;
        state.feedbackCorrectAnswer = result.feedback?.correctAnswer ?? null;
        state.feedbackExplanations = result.feedback?.explanations ?? null;
        state.feedbackRelevantText = result.feedback?.relevantText ?? null;

        // Calculate and set relevantTextRange (accessing via result.feedback)
        // This part might need adjustment if quizData is now PartialQuizData and lacks paragraph
        // We need to ensure the paragraph is available SOMEWHERE when feedback comes in.
        // OPTION: Fetch full QuizData on answer submission? Or ensure feedback includes paragraph?
        // TEMPORARY: Assume feedbackRelevantText can be found in the potentially partial quizData.paragraph
        // If quizData.paragraph is undefined, this will safely do nothing.
        if (state.quizData?.paragraph && result.feedback?.relevantText) {
          const paragraph = state.quizData.paragraph;
          const relevantText = result.feedback.relevantText;
          const startIndex = paragraph.indexOf(relevantText);
          if (startIndex !== -1) {
            const endIndex = startIndex + relevantText.length;
            state.relevantTextRange = { start: startIndex, end: endIndex };
            // console.log(
            //   '[QuizSlice handleAnswerSelect] Calculated relevantTextRange:',
            //   state.relevantTextRange
            // );
          } else {
            state.relevantTextRange = null;
            // console.warn('[QuizSlice handleAnswerSelect] Relevant text not found in paragraph.');
          }
        } else {
          state.relevantTextRange = null; // Reset if data is missing
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

  // --- NEW: submitFeedback action --- START
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
        state.loading = true; // Indicate loading while submitting feedback
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

      // Trigger loading the next quiz AFTER feedback is successfully submitted
      get().loadNextQuiz();
    } catch (error: unknown) {
      console.error('[SubmitFeedback] Error:', error);
      set((state) => {
        state.error = `Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`;
        state.loading = false;
      });
    }
  },
  // --- NEW: submitFeedback action --- END
});
