import {} from /* User, Account */ 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Discord from 'next-auth/providers/discord';
import type { NextAuthOptions } from 'next-auth';
import { validatedAuthEnv } from './config/authEnv';
import { signInCallback, jwtCallback, sessionCallback } from './auth/callbacks';

const providers = [];

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
  secret: validatedAuthEnv.NEXTAUTH_SECRET || validatedAuthEnv.AUTH_SECRET,
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
