import {} from /* User, Account */ 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
// import { JWT } from 'next-auth/jwt';
// import { Session } from 'next-auth';
// import db from './db'; // db likely not needed directly here anymore
// import { AdapterUser } from 'next-auth/adapters';
import type { NextAuthOptions } from 'next-auth';
import { validatedAuthEnv } from './config/authEnv';
import { signInCallback, jwtCallback, sessionCallback } from './auth/callbacks';

// interface UserWithEmail extends User { // Define UserWithEmail in callbacks.ts if needed there
//   email?: string | null;
// }

const providers = [];

// validatedAuthEnv is guaranteed to be an object here (throws if AUTH_SECRET missing)
if (validatedAuthEnv.GITHUB_ID && validatedAuthEnv.GITHUB_SECRET) {
  console.log('[NextAuth] GitHub OAuth credentials found, adding provider');
  providers.push(
    GitHub({
      clientId: validatedAuthEnv.GITHUB_ID,
      clientSecret: validatedAuthEnv.GITHUB_SECRET,
    })
  );
} else if (!validatedAuthEnv.GITHUB_ID && !validatedAuthEnv.GITHUB_SECRET) {
  console.warn('[NextAuth] GitHub OAuth credentials missing (GITHUB_ID and GITHUB_SECRET)');
}

if (validatedAuthEnv.GOOGLE_CLIENT_ID && validatedAuthEnv.GOOGLE_CLIENT_SECRET) {
  console.log('[NextAuth] Google OAuth credentials found, adding provider');
  providers.push(
    Google({
      clientId: validatedAuthEnv.GOOGLE_CLIENT_ID,
      clientSecret: validatedAuthEnv.GOOGLE_CLIENT_SECRET,
    })
  );
} else if (!validatedAuthEnv.GOOGLE_CLIENT_ID && !validatedAuthEnv.GOOGLE_CLIENT_SECRET) {
  console.warn(
    '[NextAuth] Google OAuth credentials missing (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'
  );
}

if (validatedAuthEnv.DISCORD_CLIENT_ID && validatedAuthEnv.DISCORD_CLIENT_SECRET) {
  console.log('[NextAuth] Discord OAuth credentials found, adding provider');
  providers.push(
    Discord({
      clientId: validatedAuthEnv.DISCORD_CLIENT_ID,
      clientSecret: validatedAuthEnv.DISCORD_CLIENT_SECRET,
    })
  );
} else if (!validatedAuthEnv.DISCORD_CLIENT_ID && !validatedAuthEnv.DISCORD_CLIENT_SECRET) {
  console.warn(
    '[NextAuth] Discord OAuth credentials missing (DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET)'
  );
}

console.log(`[NextAuth] Configured ${providers.length} authentication providers`);

export const authOptions: NextAuthOptions = {
  providers,
  secret: validatedAuthEnv.AUTH_SECRET,
  session: {
    strategy: 'jwt' as const,
  },
  pages: {},
  callbacks: {
    signIn: signInCallback,
    jwt: jwtCallback,
    session: sessionCallback,
  },
  cookies: {
    sessionToken: {
      name:
        (validatedAuthEnv.NODE_ENV ?? process.env.NODE_ENV) === 'production'
          ? `__Secure-next-auth.session-token`
          : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: (validatedAuthEnv.NODE_ENV ?? process.env.NODE_ENV) === 'production',
      },
    },
  },
};
