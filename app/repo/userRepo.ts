import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { type Account, type User } from 'next-auth';
import { type AdapterUser } from 'next-auth/adapters';
import getDb from 'app/repo/db';
import { schema } from 'app/lib/db/adapter';

const _DbUserSchema = z.object({
  id: z.number(),
  providerId: z.string(),
  provider: z.string(),
  name: z.string().nullable(),
  email: z.string().pipe(z.email()).nullable(),
  image: z.string().pipe(z.url()).nullable(),
  lastLogin: z.string(),
  language: z.string(),
});

type DbUser = z.infer<typeof _DbUserSchema>;

type AuthUser = User | AdapterUser;

const DEFAULT_LANGUAGE = 'en';

export const upsertUserOnSignIn = async (user: AuthUser, account: Account): Promise<void> => {
  if (!user.id || !user.email) {
    console.warn(
      `[UserRepository] Missing user id or email for provider ${account.provider}. Skipping DB upsert.`
    );
    return;
  }

  try {
    const db = await getDb();

    await db
      .insert(schema.users)
      .values({
        providerId: user.id,
        provider: account.provider,
        name: user.name ?? null,
        email: user.email ?? null,
        image: user.image ?? null,
        language: DEFAULT_LANGUAGE,
      })
      .onConflictDoUpdate({
        target: [schema.users.providerId, schema.users.provider],
        set: {
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? null,
          lastLogin: new Date().toISOString(),
        },
      });

    console.log(`[UserRepository] Upserted user for provider ${account.provider}, id ${user.id}`);
  } catch (error) {
    console.error('[UserRepository] Error upserting user data:', error);
    throw new Error(
      `Failed to upsert user: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const findUserByProvider = async (
  providerId: string,
  provider: string
): Promise<Pick<DbUser, 'id'> | null> => {
  try {
    const db = await getDb();

    const result = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.providerId, providerId), eq(schema.users.provider, provider)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const parseResult = z.object({ id: z.number() }).safeParse(result[0]);

    if (parseResult.success) {
      return parseResult.data;
    }

    console.error(
      `[UserRepository] Found user record for ${provider}/${providerId} but structure is invalid:`,
      result[0]
    );
    return null;
  } catch (error) {
    console.error('[UserRepository] DB error fetching user ID:', error);
    throw new Error(
      `Failed to find user by provider: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const findUserIdByProvider = async (
  providerId: string,
  provider: string
): Promise<number | undefined> => {
  try {
    const db = await getDb();

    const result = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.providerId, providerId), eq(schema.users.provider, provider)))
      .limit(1);

    return result[0]?.id;
  } catch (error) {
    console.error('[UserRepo] Error finding user ID by provider:', error);
    return undefined;
  }
};
