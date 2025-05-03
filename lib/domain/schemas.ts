import { z } from 'zod';
import { LANGUAGES, type Language } from '@/config/languages';
import { CEFRLevel } from '@/config/language-guidance';

// Helper arrays for validation (could be moved elsewhere if needed)
const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const languageKeys = Object.keys(LANGUAGES) as Language[];

// Schema for the parameters required to request a new exercise
export const ExerciseRequestParamsSchema = z.object({
  passageLanguage: z
    .string()
    .refine((val): val is Language => languageKeys.includes(val as Language), {
      message: 'Invalid passage language',
    }),
  questionLanguage: z
    .string()
    .refine((val): val is Language => languageKeys.includes(val as Language), {
      message: 'Invalid question language',
    }),
  cefrLevel: z
    .string()
    .refine((val): val is CEFRLevel => validCefrLevels.includes(val as CEFRLevel), {
      message: 'Invalid CEFR level',
    }),
});

// Exporting the inferred type for usage
export type ExerciseRequestParams = z.infer<typeof ExerciseRequestParamsSchema>;

export const QuizDataSchema = z.object({
  id: z.number().optional().nullable(),
  language: z.string().optional().nullable(),
  paragraph: z.string(),
  topic: z.string().optional().nullable(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctExplanation: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  allExplanations: z
    .object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() })
    .optional()
    .nullable(),
  relevantText: z.string().optional().nullable(),
});

export type QuizData = z.infer<typeof QuizDataSchema>;

export const PartialQuizDataSchema = QuizDataSchema.pick({
  paragraph: true,
  question: true,
  options: true,
  topic: true,
  language: true,
});
export type PartialQuizData = z.infer<typeof PartialQuizDataSchema>;

export const GenerateExerciseResultSchema = z.object({
  quizData: PartialQuizDataSchema,
  quizId: z.number(),
  error: z.string().optional().nullable(),
  cached: z.boolean().optional().nullable(),
});

export type GenerateExerciseResult = z.infer<typeof GenerateExerciseResultSchema>;

export const SubmitAnswerResultSchema = z.object({
  currentLevel: z.string().optional().nullable(),
  currentStreak: z.number().optional().nullable(),
  leveledUp: z.boolean().optional().nullable(),
  error: z.string().optional().nullable(),
  feedback: z
    .object({
      isCorrect: z.boolean(),
      correctAnswer: z.string(),
      correctExplanation: z.string(),
      chosenIncorrectExplanation: z.string().optional().nullable(),
      relevantText: z.string(),
    })
    .optional()
    .nullable(),
});

export type SubmitAnswerResult = z.infer<typeof SubmitAnswerResultSchema>;

// Represents the core content structure generated for an exercise
export const ExerciseContentSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctAnswer: z.string(),
  allExplanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  relevantText: z.string(),
  topic: z.string().optional().nullable(),
});
export type ExerciseContent = z.infer<typeof ExerciseContentSchema>; // Renamed type alias

export const LanguageLevels = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
