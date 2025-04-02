// lib/authOptions.ts
import { NextAuthOptions, User, Account } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';
import db from './db';
import { AdapterUser } from 'next-auth/adapters';

// Define a type for the user object with potential email
interface UserWithEmail extends User {
  email?: string | null;
}

// Define providers array
const providers = [];

// Add GitHub provider when not building
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
} else if (process.env.NODE_ENV === 'production') {
  console.warn('GitHub OAuth credentials missing');
}

// Add Google provider
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
} else if (process.env.NODE_ENV === 'production') {
  console.warn('Google OAuth credentials missing');
}

// Explicitly type the options object
export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt' as const,
  },
  pages: {},
  callbacks: {
    signIn({ user, account }: { user: User | AdapterUser; account: Account | null }) {
      try {
        if (user && account) {
          db.prepare(
            `
            INSERT INTO users (provider_id, provider, name, email, image, last_login)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(provider_id, provider) 
            DO UPDATE SET name = ?, email = ?, image = ?, last_login = CURRENT_TIMESTAMP
          `
          ).run(
            user.id,
            account.provider,
            user.name || null,
            user.email || null,
            user.image || null,
            user.name || null,
            user.email || null,
            user.image || null
          );
          const maskedEmail = user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null;
          console.log(
            `[AUTH] User ${user.name || maskedEmail || user.id} logged in via ${account.provider}`
          );
        }
      } catch (error) {
        console.error('[AUTH] Error storing user data:', error);
      }
      return true;
    },
    jwt({ token, user, account }: { token: JWT; user?: UserWithEmail; account?: Account | null }) {
      console.log('[AUTH JWT Callback] Invoked.');

      if (account && user && user.email) {
        console.log(
          `[AUTH JWT Callback] Processing token for user email: ${user.email} via provider: ${account.provider}`
        );

        const rawAdminEmails = process.env.ADMIN_EMAILS;
        console.log(`[AUTH JWT Callback] Raw ADMIN_EMAILS env var: '${rawAdminEmails}'`);

        const adminEmails = (rawAdminEmails || '')
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email);

        console.log(`[AUTH JWT Callback] Processed adminEmails array: [${adminEmails.join(', ')}]`);

        const isAdmin = adminEmails.includes(user.email);

        console.log(`[AUTH JWT Callback] Is user admin? ${isAdmin}`);

        token.isAdmin = isAdmin;
        token.provider = account.provider;
      } else {
        console.log(
          '[AUTH JWT Callback] Conditions not met for setting isAdmin (account/user/email missing). Token:',
          token
        );
      }
      console.log('[AUTH JWT Callback] Returning token:', token);
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      console.log('[AUTH Session Callback] Invoked. Token received:', token);

      if (session.user) {
        const isAdminValue = token.isAdmin as boolean | undefined;
        (session.user as { isAdmin?: boolean }).isAdmin = isAdminValue;
        console.log(`[AUTH Session Callback] Assigning isAdmin=${isAdminValue} to session user.`);
      } else {
        console.log('[AUTH Session Callback] Session user object not found.');
      }
      console.log('[AUTH Session Callback] Returning session:', session);
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? `__Secure-next-auth.session-token`
          : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
