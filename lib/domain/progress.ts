import { z } from 'zod';
import { CEFRLevelSchema, CEFR_LEVELS } from './language-guidance';

// Schema for the data structure representing user progress in the database
export const UserLanguageProgressSchema = z.object({
  user_id: z.number().int(),
  language_code: z.string().length(2), // Assuming 2-letter language codes
  cefr_level: CEFRLevelSchema,
  correct_streak: z.number().int().nonnegative(),
  last_practiced: z.date().optional().nullable(), // Represented as ISO string in DB, Zod handles parsing
});
export type UserLanguageProgress = z.infer<typeof UserLanguageProgressSchema>;

// Schema for the result returned after updating progress
export const ProgressUpdateResultSchema = z.object({
  currentLevel: CEFRLevelSchema,
  currentStreak: z.number().int().nonnegative(),
  leveledUp: z.boolean(),
  error: z.string().optional(),
});
export type ProgressUpdateResult = z.infer<typeof ProgressUpdateResultSchema>;

// Export CEFR_LEVELS from here as well for convenience if needed elsewhere directly from progress context
export { CEFR_LEVELS };

// Removed GetProgressResultSchema as ProgressUpdateResultSchema covers the primary use case
// and fetching progress directly should likely use UserLanguageProgressSchema.
// If a specific "get progress" endpoint needs a different shape, a new schema can be created.
