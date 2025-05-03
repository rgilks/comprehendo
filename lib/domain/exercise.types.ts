import { z } from 'zod';

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
