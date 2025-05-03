import { z } from 'zod';
import { LanguageSchema } from './language';
import { CEFRLevelSchema } from './language-guidance';

export const ExerciseGenerationParamsSchema = z.object({
  topic: z.string(),
  passageLanguage: LanguageSchema,
  questionLanguage: LanguageSchema,
  passageLangName: z.string(),
  questionLangName: z.string(),
  level: CEFRLevelSchema,
  grammarGuidance: z.string(),
  vocabularyGuidance: z.string(),
});

export type ExerciseGenerationParams = z.infer<typeof ExerciseGenerationParamsSchema>;
