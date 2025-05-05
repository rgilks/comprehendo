import db from '../db';
import { z } from 'zod';
import { type Account, type User } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';

// Define Zod schema for user data from the DB
// Use this schema for validation if returning full user objects in the future
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DbUserSchema = z.object({
  id: z.number(),
  provider_id: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  image: z.string().url().nullable(),
  last_login: z.string(), // Assuming stored as ISO string or similar
  language: z.string(),
});

// Use this schema for validation if returning full user objects in the future
// export type DbUser = z.infer<typeof DbUserSchema>; // Still commented out, but referenced below
type DbUser = z.infer<typeof DbUserSchema>; // Type for user returned from DB queries

// Type for user returned from DB queries
// type DbUser = z.infer<typeof DbUserSchema>; // Commented out as schema isn't used for validation yet

// Type combining NextAuth User/AdapterUser for input clarity
type AuthUser = User | AdapterUser;

const DEFAULT_LANGUAGE = 'en';

export const upsertUserOnSignIn = (user: AuthUser, account: Account): void => {
  if (!user.id || !user.email) {
    console.warn(
      `[UserRepository] Missing user id or email for provider ${account.provider}. Skipping DB upsert.`
    );
    return;
  }
  try {
    db.prepare(
      `
      INSERT INTO users (provider_id, provider, name, email, image, last_login, language)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(provider_id, provider)
      DO UPDATE SET name = ?, email = ?, image = ?, last_login = CURRENT_TIMESTAMP
    `
    ).run(
      user.id,
      account.provider,
      user.name ?? null,
      user.email ?? null,
      user.image ?? null,
      DEFAULT_LANGUAGE,
      user.name ?? null,
      user.email ?? null,
      user.image ?? null
    );
    console.log(`[UserRepository] Upserted user for provider ${account.provider}, id ${user.id}`);
  } catch (error) {
    console.error('[UserRepository] Error upserting user data:', error);
    // Re-throw or handle more specifically if needed
    throw new Error(
      `Failed to upsert user: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const findUserByProvider = (
  providerId: string,
  provider: string
): Pick<DbUser, 'id'> | null => {
  try {
    const userRecord = db
      .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
      .get(providerId, provider);

    // Validate the structure of the fetched record
    const result = z.object({ id: z.number() }).safeParse(userRecord);

    if (result.success) {
      return result.data;
    }

    if (userRecord) {
      // Log if a record was found but didn't match the expected structure
      console.error(
        `[UserRepository] Found user record for ${provider}/${providerId} but structure is invalid:`,
        userRecord
      );
    }
    // Return null if not found or structure is invalid
    return null;
  } catch (error) {
    console.error('[UserRepository] DB error fetching user ID:', error);
    // Re-throw or handle more specifically if needed
    throw new Error(
      `Failed to find user by provider: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};
