import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/comprehendo.sqlite',
  },
  verbose: true,
  strict: true,
} satisfies Config;
