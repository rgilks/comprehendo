import db from '@/lib/drizzle-db';
import { users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { type Account, type User as NextAuthUser } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';
import { type User } from '../domain/schema';

// Define Zod schema for user data from the DB
// Use this schema for validation if returning full user objects in the future

// Type for user returned from DB queries
// type DbUser = z.infer<typeof DbUserSchema>; // Commented out as schema isn't used for validation yet

// Type combining NextAuth User/AdapterUser for input clarity
type AuthUser = NextAuthUser | AdapterUser;

const DEFAULT_LANGUAGE = 'en';

export const upsertUserOnSignIn = async (user: AuthUser, account: Account): Promise<void> => {
  if (!user.id || !user.email) {
    console.warn(
      `[UserRepository] Missing user id or email for provider ${account.provider}. Skipping DB upsert.`
    );
    return;
  }
  try {
    await db
      .insert(users)
      .values({
        providerId: user.id,
        provider: account.provider,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        lastLogin: new Date(),
        language: DEFAULT_LANGUAGE,
      })
      .onConflictDoUpdate({
        target: [users.providerId, users.provider],
        set: {
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          lastLogin: new Date(),
        },
      })
      .execute();
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
): Pick<User, 'id'> | null => {
  try {
    const userRecord = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.providerId, providerId), eq(users.provider, provider)))
      .get();

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

/**
 * Finds a user's internal database ID based on their OAuth provider and provider-specific ID.
 */
export const findUserIdByProvider = (providerId: string, provider: string): number | undefined => {
  try {
    const result = db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.providerId, providerId), eq(users.provider, provider)))
      .get();
    return result?.id;
  } catch (error) {
    console.error('[UserRepo] Error finding user ID by provider:', error);
    return undefined;
  }
};
