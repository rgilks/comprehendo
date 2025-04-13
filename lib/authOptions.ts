import { User, Account } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';
import db from './db';
import { AdapterUser } from 'next-auth/adapters';
import { z } from 'zod';
import type { NextAuthOptions } from 'next-auth';

// --- Zod Schema for Auth Environment Variables ---
export const authEnvSchema = z
  .object({
    GITHUB_ID: z.string().optional(),
    GITHUB_SECRET: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    AUTH_SECRET: z.string({ required_error: '[NextAuth] ERROR: AUTH_SECRET is missing!' }),
    NEXTAUTH_URL: z.string().url().optional(),
    ADMIN_EMAILS: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.GITHUB_ID && !data.GITHUB_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GITHUB_SECRET is required when GITHUB_ID is set',
        path: ['GITHUB_SECRET'],
      });
    }
    if (!data.GITHUB_ID && data.GITHUB_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GITHUB_ID is required when GITHUB_SECRET is set',
        path: ['GITHUB_ID'],
      });
    }
    if (data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_CLIENT_SECRET is required when GOOGLE_CLIENT_ID is set',
        path: ['GOOGLE_CLIENT_SECRET'],
      });
    }
    if (!data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GOOGLE_CLIENT_ID is required when GOOGLE_CLIENT_SECRET is set',
        path: ['GOOGLE_CLIENT_ID'],
      });
    }
    if (!data.NEXTAUTH_URL && data.NODE_ENV === 'production') {
      console.warn('[NextAuth] NEXTAUTH_URL is not set, this might cause issues in production');
    }
  });

// Parse and validate auth environment variables at startup
const authEnvVars = authEnvSchema.safeParse(process.env);

if (!authEnvVars.success) {
  console.error(
    '❌ Invalid Auth environment variables:',
    JSON.stringify(authEnvVars.error.format(), null, 4)
  );
  // Critical issues like missing AUTH_SECRET are caught by required_error
  // Other warnings are logged. Proceed cautiously.
}

const validatedAuthEnv = authEnvVars.success ? authEnvVars.data : undefined;
// --- End Zod Schema ---

interface UserWithEmail extends User {
  email?: string | null;
}

const providers = [];

// Use validated env vars safely
if (validatedAuthEnv?.GITHUB_ID && validatedAuthEnv?.GITHUB_SECRET) {
  console.log('[NextAuth] GitHub OAuth credentials found, adding provider');
  providers.push(
    GitHub({
      clientId: validatedAuthEnv.GITHUB_ID,
      clientSecret: validatedAuthEnv.GITHUB_SECRET,
    })
  );
} else if (!validatedAuthEnv?.GITHUB_ID && !validatedAuthEnv?.GITHUB_SECRET) {
  // Only warn if neither is set, refinement handles case where only one is set
  console.warn('[NextAuth] GitHub OAuth credentials missing (GITHUB_ID and GITHUB_SECRET)');
}

// Use validated env vars safely
if (validatedAuthEnv?.GOOGLE_CLIENT_ID && validatedAuthEnv?.GOOGLE_CLIENT_SECRET) {
  console.log('[NextAuth] Google OAuth credentials found, adding provider');
  providers.push(
    Google({
      clientId: validatedAuthEnv.GOOGLE_CLIENT_ID,
      clientSecret: validatedAuthEnv.GOOGLE_CLIENT_SECRET,
    })
  );
} else if (!validatedAuthEnv?.GOOGLE_CLIENT_ID && !validatedAuthEnv?.GOOGLE_CLIENT_SECRET) {
  // Only warn if neither is set, refinement handles case where only one is set
  console.warn(
    '[NextAuth] Google OAuth credentials missing (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'
  );
}

// Log active providers count
console.log(`[NextAuth] Configured ${providers.length} authentication providers`);

// Checks for AUTH_SECRET and NEXTAUTH_URL in production are handled by Zod validation above

export const authOptions: NextAuthOptions = {
  providers,
  // Use validated secret, provide default empty string if validation failed or env is undefined
  secret: validatedAuthEnv?.AUTH_SECRET || '',
  debug: (validatedAuthEnv?.NODE_ENV || process.env.NODE_ENV) !== 'production',
  session: {
    strategy: 'jwt' as const,
  },
  pages: {},
  callbacks: {
    signIn: ({ user, account }: { user: User | AdapterUser; account: Account | null }) => {
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
    jwt: ({
      token,
      user,
      account,
    }: {
      token: JWT;
      user?: UserWithEmail;
      account?: Account | null;
    }) => {
      console.log('[AUTH JWT Callback] Invoked.');

      if (account && user && user.email) {
        console.log(
          `[AUTH JWT Callback] Processing token for user email: ${user.email} via provider: ${account.provider}`
        );

        const rawAdminEmails = validatedAuthEnv?.ADMIN_EMAILS;
        console.log(`[AUTH JWT Callback] Raw ADMIN_EMAILS env var: '${rawAdminEmails || ''}'`);

        let adminEmails: string[] = [];
        if (typeof rawAdminEmails === 'string' && rawAdminEmails.length > 0) {
          adminEmails = rawAdminEmails
            .split(',')
            .map((email) => email.trim())
            .filter((email): email is string => !!email);
        }

        console.log(`[AUTH JWT Callback] Processed adminEmails array: [${adminEmails.join(', ')}]`);

        const isAdmin = adminEmails.includes(user.email);

        console.log(`[AUTH JWT Callback] Is user admin? ${isAdmin}`);

        token.isAdmin = isAdmin;
        token.provider = account.provider;
      } else {
        console.log(
          '[AUTH JWT Callback] Conditions not met for setting isAdmin (account/user/email missing).'
        );
      }

      return token;
    },
    session: ({ session, token }: { session: Session; token: JWT }) => {
      // Assign dbId and isAdmin fetched earlier
      if (session.user && token.sub && token.provider) {
        try {
          const userRecord = db
            .prepare('SELECT id FROM users WHERE provider_id = ? AND provider = ?')
            .get(token.sub, token.provider);

          if (
            userRecord &&
            typeof userRecord === 'object' &&
            'id' in userRecord &&
            typeof userRecord.id === 'number'
          ) {
            session.user.dbId = userRecord.id; // Assign internal DB id
          } else {
            console.warn(
              `[AUTH Session Callback] Could not find user or userRecord format is incorrect for provider_id=${token.sub} and provider=${token.provider}.`
            );
          }
        } catch (error) {
          console.error('[AUTH Session Callback] Error fetching internal user ID:', error);
        }

        // Assign standard user ID from token
        session.user.id = token.sub;
        // Assign isAdmin status from token
        const isAdminValue = token.isAdmin;
        session.user.isAdmin = isAdminValue;
      } else {
        // Handle case where session.user or token.sub/provider is missing
        console.warn(
          '[AUTH Session Callback] session.user, token.sub, or token.provider missing. Cannot assign id/isAdmin.'
        );
      }
      // Return the standard session object without the custom error property
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name:
        (validatedAuthEnv?.NODE_ENV || process.env.NODE_ENV) === 'production'
          ? `__Secure-next-auth.session-token`
          : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: (validatedAuthEnv?.NODE_ENV || process.env.NODE_ENV) === 'production',
      },
    },
  },
};
