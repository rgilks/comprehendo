import { z } from 'zod';
import { CEFRLevelSchema, CEFR_LEVELS } from './language-guidance';

export const ProgressSchema = z.object({
  user_id: z.number().int(),
  language_code: z.string().length(2),
  cefr_level: CEFRLevelSchema,
  correct_streak: z.number().int().nonnegative(),
  last_practiced: z.date().optional().nullable(),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const ProgressUpdateResultSchema = z.object({
  currentLevel: CEFRLevelSchema,
  currentStreak: z.number().int().nonnegative(),
  leveledUp: z.boolean(),
  error: z.string().optional(),
});
export type ProgressUpdateResult = z.infer<typeof ProgressUpdateResultSchema>;

export { CEFR_LEVELS };
