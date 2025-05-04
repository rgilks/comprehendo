import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

interface SessionUser extends NonNullable<Session['user']> {
  dbId?: number;
}

export const getAuthenticatedUserId = async (): Promise<number | null> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    return null;
  }

  return sessionUser.dbId;
};

export const getAuthenticatedSessionUser = async (): Promise<SessionUser | null> => {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUser | undefined;

  if (!session || !sessionUser?.dbId) {
    return null;
  }

  return sessionUser;
};
