import { z } from 'zod';

// Export the API response schema for potential use elsewhere
export const apiResponseSchema = z.object({
  result: z.string(),
});
