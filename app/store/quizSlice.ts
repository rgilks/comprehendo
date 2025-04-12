import type { StateCreator } from 'zustand';
import { z } from 'zod'; // Import Zod
// import type { PartialQuizData } from '@/app/actions/exercise';
import { submitAnswer } from '@/app/actions/userProgress';
import { generateExerciseResponse } from '@/app/actions/exercise';
import type { TextGeneratorState } from './textGeneratorStore';
import { getSession } from 'next-auth/react';
import type { CEFRLevel } from '@/config/language-guidance'; // Keep CEFRLevel if used elsewhere in file
import {} from '@/contexts/LanguageContext'; // Removed unused Language type and LANGUAGES map

// Define QuizData type used within the store
// type QuizData = PartialQuizData; // Now imported

// --- Zod Schemas --- START
const QuizDataSchema = z.object({
  id: z.number().optional().nullable(),
  language: z.string().optional().nullable(), // Make language optional
  paragraph: z.string(),
  topic: z.string().optional().nullable(),
  // Add other expected fields from PartialQuizData if necessary
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
});

// Define and Export QuizData type based on local schema
export type QuizData = z.infer<typeof QuizDataSchema>;

const GenerateExerciseResultSchema = z.object({
  result: z.string(), // Expect stringified JSON
  quizId: z.number(),
  error: z.string().optional().nullable(),
  cached: z.boolean().optional().nullable(), // Add other fields from payload if needed
  // usage: z.object({ promptTokens: z.number(), completionTokens: z.number() }).optional().nullable(),
});

const SubmitAnswerResultSchema = z.object({
  currentLevel: z.string().optional().nullable(),
  currentStreak: z.number().optional().nullable(),
  leveledUp: z.boolean().optional().nullable(),
  error: z.string().optional().nullable(),
  feedback: z
    .object({
      isCorrect: z.boolean(),
      correctAnswer: z.string(),
      explanations: z.object({
        A: z.string(),
        B: z.string(),
        C: z.string(),
        D: z.string(),
      }),
      relevantText: z.string(),
    })
    .optional()
    .nullable(),
  // Add other potential top-level fields like nextQuiz if needed
});
// --- Zod Schemas --- END

// Define the shape of the pre-fetched quiz data
interface NextQuizInfo {
  quizData: QuizData;
  quizId: number;
}

export interface QuizSlice {
  quizData: QuizData | null;
  currentQuizId: number | null;
  selectedAnswer: string | null;
  isAnswered: boolean;
  relevantTextRange: { start: number; end: number } | null;
  feedbackIsCorrect: boolean | null;
  feedbackCorrectAnswer: string | null;
  feedbackExplanations: { A: string; B: string; C: string; D: string } | null;
  feedbackRelevantText: string | null;
  nextQuizAvailable: NextQuizInfo | null;

  setQuizData: (data: QuizData | null) => void;
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
  resetQuizState: () => void;
  resetQuizWithNewData: (newQuizData: QuizData, quizId: number) => void;
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

  setQuizData: (data) => set({ quizData: data }),
  setSelectedAnswer: (answer) => set({ selectedAnswer: answer }),
  setIsAnswered: (answered) => set({ isAnswered: answered }),
  setRelevantTextRange: (range) => set({ relevantTextRange: range }),
  setFeedback: (correct, correctAnswer, explanations, relevantText) =>
    set({
      feedbackIsCorrect: correct,
      feedbackCorrectAnswer: correctAnswer,
      feedbackExplanations: explanations,
      feedbackRelevantText: relevantText,
    }),

  _setNextQuizAvailable: (info) => set({ nextQuizAvailable: info }),

  resetQuizState: () => {
    set({
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
    });
  },

  resetQuizWithNewData: (newQuizData: QuizData, quizId: number) => {
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
      state.showQuestionSection = false;
      state.showExplanation = false;
      state.showContent = true;
      state.loading = false;
      state.error = null;
      const currentPassageLanguage = get().passageLanguage;
      state.generatedPassageLanguage = currentPassageLanguage;
      state.nextQuizAvailable = null;
    });

    get().clearQuestionDelayTimeout();
    const timeoutId = setTimeout(() => get().setShowQuestionSection(true), 1000);
    get().setQuestionDelayTimeoutRef(timeoutId);
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
      get().clearQuestionDelayTimeout();
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

      // Parse the result string into quizData
      let quizData: QuizData | null = null;
      try {
        const parsedResult = QuizDataSchema.safeParse(JSON.parse(response.result));
        if (parsedResult.success) {
          quizData = parsedResult.data;
          if (!quizData.language) {
            quizData.language = get().passageLanguage;
          }
        } else {
          console.error(
            'Zod validation error (parsing result string):',
            parsedResult.error.message
          );
          throw new Error(`Invalid quiz data structure in response: ${parsedResult.error.message}`);
        }
      } catch (parseError: unknown) {
        console.error('Error parsing quiz data from response result string:', parseError);
        console.error('Problematic string:', response.result);
        throw new Error('Failed to parse quiz data from server.');
      }

      // Now check the parsed quizData
      if (!quizData) {
        // This case should ideally be caught by the parsing errors above
        throw new Error('Failed to generate text. No quiz data in response after parsing.');
      }

      // Use parsed quizData and response.quizId
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

    set({ selectedAnswer: answer, isAnswered: true, showExplanation: true });
    const session = await getSession();
    const { currentQuizId } = get();

    if (typeof currentQuizId !== 'number') {
      console.error('Invalid or missing current quiz ID:', currentQuizId);
      set({
        error: 'Cannot submit answer: Invalid quiz ID.',
        isAnswered: false,
        selectedAnswer: null,
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
});
