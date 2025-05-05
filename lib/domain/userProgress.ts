import { z } from 'zod';
import { CEFRLevelSchema } from './language-guidance';

export const GetProgressResultSchema = z.object({
  streak: z.number().optional().nullable(),
  currentLevel: CEFRLevelSchema.optional().nullable(), // Validate against CEFR levels
  error: z.string().optional().nullable(),
});

export type GetProgressResult = z.infer<typeof GetProgressResultSchema>;
