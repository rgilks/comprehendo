import db from '@/lib/db';
import type { Session } from 'next-auth';

/**
 * Retrieves the database user ID based on the provider ID and provider from the session.
 * Performs a direct database lookup.
 *
 * @param session The NextAuth session object.
 * @returns The user's database ID, or null if not found or an error occurs.
 */
export const getDbUserIdFromSession = (session: Session | null): number | null => {
  if (session?.user.id && session.user.provider) {
    try {
      const userRecord = db
        .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
        .get(session.user.id, session.user.provider);
      if (
        userRecord &&
        typeof userRecord === 'object' &&
        'id' in userRecord &&
        typeof userRecord.id === 'number'
      ) {
        return userRecord.id;
      } else {
        console.warn(
          `[getDbUserIdFromSession] Direct lookup failed: Could not find user for providerId: ${session.user.id}, provider: ${session.user.provider}`
        );
        return null;
      }
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
