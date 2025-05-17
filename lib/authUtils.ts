import { findUserIdByProvider } from '@/lib/repo/userRepository';
import type { Session } from 'next-auth';

export const getDbUserIdFromSession = (session: Session | null): number | null => {
  if (session?.user.id && session.user.provider) {
    try {
      const userId = findUserIdByProvider(session.user.id, session.user.provider);

      if (userId === undefined) {
        console.warn(
          `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
        );
        return null;
      }
      return userId;
    } catch (dbError) {
      console.error('[getDbUserIdFromSession] Direct lookup DB error:', dbError);
      return null; // Return null on DB error
    }
  } else {
    // Log less verbosely if session or required user fields are just missing
    if (session) {
      console.warn(
        `[getDbUserIdFromSession] Cannot perform direct lookup: Missing session.user.id (${session.user.id}) or session.user.provider (${session.user.provider})`
      );
    }
    return null;
  }
};
