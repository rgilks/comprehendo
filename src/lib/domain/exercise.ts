import { z } from 'zod';

export const CEFRLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const LanguageSchema = z.enum([
  'zh', // Chinese
  'en', // English
  'fil', // Filipino
  'fr', // French
  'de', // German
  'el', // Greek
  'he', // Hebrew
  'hi', // Hindi
  'it', // Italian
  'ja', // Japanese
  'ko', // Korean
  'la', // Latin
  'pl', // Polish
  'pt', // Portuguese
  'ru', // Russian
  'es', // Spanish
  'th', // Thai
]);

export const ExerciseSchema = z.object({
  paragraph: z.string().min(1),
  topic: z.string().min(1),
  question: z.string().min(1),
  options: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  allExplanations: z.object({
    A: z.string().min(1),
    B: z.string().min(1),
    C: z.string().min(1),
    D: z.string().min(1),
  }),
  relevantText: z.string().min(1),
});

export type Exercise = z.infer<typeof ExerciseSchema>;
