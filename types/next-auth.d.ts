// types/next-auth.d.ts
import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extends the built-in session.user type
   */
  interface User {
    dbId?: number;
    isAdmin?: boolean;
  }

  interface Session {
    user?: User & {
      // Ensure user object in session includes our custom fields
      // Keep default fields if needed, e.g., name, email, image
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extends the built-in JWT type
   */
  interface JWT {
    dbId?: number;
    isAdmin?: boolean;
    provider?: string;
  }
}
