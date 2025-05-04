import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

interface SessionUser extends NonNullable<Session['user']> {
  dbId?: number;
}

/**
 * Retrieves the authenticated user's database ID from the session.
 * @returns The user's database ID if authenticated and found, otherwise null.
 */
export const getAuthenticatedUserId = async (): Promise<number | null> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    return null;
  }

  return sessionUser.dbId;
};

/**
 * Retrieves the session user object, including the database ID.
 * Useful when more than just the ID is needed but still requires authentication check.
 * @returns The SessionUser object if authenticated and found, otherwise null.
 */
export const getAuthenticatedSessionUser = async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    return null;
  }

  return sessionUser;
};
