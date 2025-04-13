// types/next-auth.d.ts
import 'next-auth';
import { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    dbId?: number;
    isAdmin?: boolean;
  }

  interface Session {
    user?: User & {
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    dbId?: number;
    isAdmin?: boolean;
    provider?: string;
  }
}
