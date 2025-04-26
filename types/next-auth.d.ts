// types/next-auth.d.ts
import 'next-auth';
import { DefaultSession, DefaultUser } from 'next-auth';

declare module 'next-auth' {
  interface User extends DefaultUser {
    dbId?: number;
    isAdmin?: boolean;
  }

  interface Session {
    user: {
      id?: string | null;
      dbId?: number | null;
      isAdmin?: boolean | null;
      provider?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    dbId?: number | null;
    isAdmin?: boolean | null;
    provider?: string | null;
  }
}
