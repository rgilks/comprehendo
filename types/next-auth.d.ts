// types/next-auth.d.ts
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      dbId?: number;
      isAdmin?: boolean;
      provider?: string;
    } & DefaultSession['user'];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends DefaultUser {}
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    dbId?: number;
    provider?: string;
    isAdmin?: boolean;
  }
}
