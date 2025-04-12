import { z } from 'zod';

// --- Quiz Domain ---

export const QuizDataSchema = z.object({
  id: z.number().optional().nullable(),
  language: z.string().optional().nullable(),
  paragraph: z.string(),
  topic: z.string().optional().nullable(),
  question: z.string(),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
  explanations: z
    .object({ A: z.string(), B: z.string(), C: z.string(), D: z.string() })
    .optional()
    .nullable(),
  correctAnswer: z.string().optional().nullable(),
  relevantText: z.string().optional().nullable(),
});

export type QuizData = z.infer<typeof QuizDataSchema>;

// --- API Response Schemas ---

export const GenerateExerciseResultSchema = z.object({
  result: z.string(), // Stringified JSON containing QuizData
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
});

export type SubmitAnswerResult = z.infer<typeof SubmitAnswerResultSchema>;

// --- Partial Schema for Initial Client Data ---

// Define PartialQuizData based on the imported QuizDataSchema
export const PartialQuizDataSchema = QuizDataSchema.pick({
  paragraph: true,
  question: true,
  options: true,
  topic: true,
  language: true, // Keep language if it's needed by the client initially
});
export type PartialQuizData = z.infer<typeof PartialQuizDataSchema>;
