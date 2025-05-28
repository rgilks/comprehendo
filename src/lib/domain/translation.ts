import { z } from 'zod';

export const TranslationResultSchema = z.object({
  translation: z.string(),
  romanization: z.string().optional(),
});

export type TranslationResult = z.infer<typeof TranslationResultSchema>;
