import { z } from 'zod';

export const authEnvSchema = z
  .object({
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
    AUTH_SECRET: z.string({ required_error: '[NextAuth] ERROR: AUTH_SECRET is missing!' }),
    NEXTAUTH_URL: z.string().url().optional(),
    ADMIN_EMAILS: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean)
          : []
      ),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.GITHUB_ID && !data.GITHUB_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GITHUB_SECRET is required when GITHUB_ID is set',
        path: ['GITHUB_SECRET'],
      });
    }
    if (!data.GITHUB_ID && data.GITHUB_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GITHUB_ID is required when GITHUB_SECRET is set',
        path: ['GITHUB_ID'],
      });
    }
    if (data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set',
        path: ['GOOGLE_CLIENT_SECRET'],
      });
    }
    if (!data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_CLIENT_ID is required when GOOGLE_CLIENT_SECRET is set',
        path: ['GOOGLE_CLIENT_ID'],
      });
    }
    if (data.DISCORD_CLIENT_ID && !data.DISCORD_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DISCORD_CLIENT_SECRET is required when DISCORD_CLIENT_ID is set',
        path: ['DISCORD_CLIENT_SECRET'],
      });
    }
    if (!data.DISCORD_CLIENT_ID && data.DISCORD_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DISCORD_CLIENT_ID is required when DISCORD_CLIENT_SECRET is set',
        path: ['DISCORD_CLIENT_ID'],
      });
    }
    if (!data.NEXTAUTH_URL && data.NODE_ENV === 'production') {
      console.warn('[NextAuth] NEXTAUTH_URL is not set, this might cause issues in production');
    }
  });

const authEnvVars = authEnvSchema.safeParse(process.env);

if (!authEnvVars.success) {
  console.error(
    '❌ Invalid Auth environment variables:',
    JSON.stringify(authEnvVars.error.format(), null, 4)
  );
  // Only throw if AUTH_SECRET is missing AND we are NOT in the build phase
  const authSecretError = authEnvVars.error.errors.find(
    (e) => e.path.length > 0 && e.path[0] === 'AUTH_SECRET'
  );
  if (authSecretError && process.env['NEXT_PHASE'] !== 'phase-production-build') {
    throw new Error(authSecretError.message);
  }
  // For other errors or during build, log but allow continuation
}

export const validatedAuthEnv = authEnvVars.success
  ? authEnvVars.data
  : ({} as z.infer<typeof authEnvSchema>); // Provide a default empty object if validation fails but AUTH_SECRET is present
