import db from '../lib/db';
import { z } from 'zod';
import { type Account, type User } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';

const _DbUserSchema = z.object({
  id: z.number(),
  provider_id: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  email: z.string().email().nullable(),
  image: z.string().url().nullable(),
  last_login: z.string(),
  language: z.string(),
});

type DbUser = z.infer<typeof _DbUserSchema>;

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

    const result = z.object({ id: z.number() }).safeParse(userRecord);

    if (result.success) {
      return result.data;
    }

    if (userRecord) {
      console.error(
        `[UserRepository] Found user record for ${provider}/${providerId} but structure is invalid:`,
        userRecord
      );
    }
    return null;
  } catch (error) {
    console.error('[UserRepository] DB error fetching user ID:', error);
    throw new Error(
      `Failed to find user by provider: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const findUserIdByProvider = (providerId: string, provider: string): number | undefined => {
  try {
    const result = db
      .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
      .get(providerId, provider) as { id: number } | undefined;
    return result?.id;
  } catch (error) {
    console.error('[UserRepo] Error finding user ID by provider:', error);
    return undefined;
  }
};
