import { z } from 'zod';

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
