// lib/authOptions.ts
import { NextAuthOptions, User, Account } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';
import db from './db';

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
  callbacks: {
    signIn({ user, account }) {
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
      if (account && user && user.email) {
        const adminEmails = (process.env.ADMIN_EMAILS || '')
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email);
        const isAdmin = adminEmails.includes(user.email);
        token.isAdmin = isAdmin;
        token.provider = account.provider;
      }
      return token;
    },
    session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean | undefined;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
