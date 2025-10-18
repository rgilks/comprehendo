import { ZodError } from 'zod';

export const extractZodErrors = (error: ZodError): string =>
  error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
