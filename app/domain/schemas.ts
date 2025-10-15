import { z } from 'zod';
import { LANGUAGES, type Language } from 'app/domain/language';
import type { CEFRLevel } from 'app/domain/language-guidance';

const validCefrLevels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const languageKeys = Object.keys(LANGUAGES) as Language[];

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
  excludeQuizId: z.number().optional().nullable(),
});

export type ExerciseRequestParams = z.infer<typeof ExerciseRequestParamsSchema>;

export const QuizDataSchema = z.object({
  id: z.number().optional().nullable(),
  language: z.string().optional().nullable(),
  paragraph: z.string(),
  topic: z.string().optional().nullable(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctExplanation: z.string().optional().nullable(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
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

export const ExerciseContentSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  allExplanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  relevantText: z.string(),
  topic: z.string().optional().nullable(),
});
export type ExerciseContent = z.infer<typeof ExerciseContentSchema>;

export const LanguageLevels = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const VoiceInfoSchema = z.object({
  uri: z.string(),
  displayName: z.string(),
});

export type VoiceInfo = z.infer<typeof VoiceInfoSchema>;

export const TopicCategorySchema = z.object({
  name: z.string(),
  topics: z.array(z.string()),
});

export const CEFRTopicsSchema = z.record(z.string(), z.array(TopicCategorySchema));

export type TopicCategory = z.infer<typeof TopicCategorySchema>;
export type CEFRTopics = z.infer<typeof CEFRTopicsSchema>;

export const ExerciseOptionsSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string(),
  D: z.string(),
});
export type ExerciseOptions = z.infer<typeof ExerciseOptionsSchema>;

export const ExerciseExplanationSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string(),
  D: z.string(),
});
export type ExerciseExplanation = z.infer<typeof ExerciseExplanationSchema>;

export const GeneratedExerciseSchema = z.object({
  paragraph: z.string(),
  topic: z.string(),
  question: z.string(),
  options: ExerciseOptionsSchema,
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  allExplanations: ExerciseExplanationSchema,
  relevantText: z.string(),
});
export type GeneratedExercise = z.infer<typeof GeneratedExerciseSchema>;

export const apiResponseSchema = z.object({
  result: z.string(),
});
export type ApiResponse = z.infer<typeof apiResponseSchema>;

export const InitialExercisePairResultSchema = z.object({
  quizzes: z.array(GenerateExerciseResultSchema).min(0).max(2),
  error: z.string().nullable(),
});

export type InitialExercisePairResult = z.infer<typeof InitialExercisePairResultSchema>;

export const SessionUserSchema = z.object({
  dbId: z.number(),
  name: z.string().optional(),
  email: z.string().optional(),
  image: z.string().optional(),
});

export type SessionUser = z.infer<typeof SessionUserSchema>;
