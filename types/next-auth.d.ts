// types/next-auth.d.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extends the built-in session.user type
   */
  interface Session {
    user: {
      /** The user's id from the provider */
      id: string;
      /** The user's internal database id */
      dbId?: number;
      /** Whether the user is an admin */
      isAdmin?: boolean;
      /** The provider used for authentication */
      provider?: string;
    } & DefaultSession['user']; // Keep the default properties
  }

  /**
   * Extends the built-in user type
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends DefaultUser {
    // Add custom properties to User if needed, though often Session is enough
    // email?: string | null; // Already handled by DefaultUser potentially
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extends the built-in JWT type
   */
  interface JWT extends DefaultJWT {
    /** Internal database ID */
    dbId?: number;
    /** Authentication provider */
    provider?: string;
    /** Admin status */
    isAdmin?: boolean;
    // Note: email is already part of DefaultJWT if needed
  }
}
