import { User, Account, Session } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import { JWT } from 'next-auth/jwt';
import db from '../db';
import { validatedAuthEnv } from '../config/authEnv';
import { upsertUserOnSignIn, findUserByProvider } from '../repositories/userRepository';

interface UserWithEmail extends User {
  email?: string | null;
}

export const signInCallback = ({
  user,
  account,
}: {
  user: User | AdapterUser;
  account: Account | null;
}): boolean => {
  try {
    // Let upsertUserOnSignIn handle checks for valid user/account details
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (account && user) {
      upsertUserOnSignIn(user, account);
    }
    if (account && user.id && user.email) {
      // Added checks for user.id and user.email
      db.prepare(
        `
        INSERT INTO users (provider_id, provider, name, email, image, last_login, language)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(provider_id, provider)
        DO UPDATE SET name = ?, email = ?, image = ?, last_login = CURRENT_TIMESTAMP
      `
      ).run(
        user.id,
        account.provider,
        user.name || null,
        user.email || null,
        user.image || null,
        'en', // Default language, consider making configurable
        user.name || null,
        user.email || null,
        user.image || null
      );
    } else if (account) {
      console.warn(
        `[AUTH SignIn Callback] Missing user id or email for provider ${account.provider}. Skipping DB upsert.`
      );
    }
  } catch (error) {
    console.error('[AUTH SignIn Callback] Error during sign in process:', error);
    // If upsertUserOnSignIn throws, the error is caught here.
    // Decide if sign-in should be prevented on DB error.
    return false; // Prevent sign-in on DB error
  }
  return true; // Allows sign-in even if DB operation fails
};

export const jwtCallback = ({
  token,
  user,
  account,
}: {
  token: JWT;
  user?: UserWithEmail;
  account?: Account | null;
}): JWT => {
  if (account && user?.id && user.email) {
    token.provider = account.provider;
    token.email = user.email;

    try {
      const userRecord = findUserByProvider(user.id, account.provider);

      if (userRecord) {
        token.dbId = userRecord.id;
      } else {
        console.error(
          `[AUTH JWT Callback] CRITICAL: Could not find user in DB during JWT creation for provider_id=${user.id}, provider=${account.provider}. dbId will be missing!`
        );
        // Potentially throw an error here if dbId is strictly required
      }
    } catch (error) {
      console.error('[AUTH JWT Callback] CRITICAL: Error resolving user DB ID for token:', error);
      // Consider implications: Should JWT creation fail if DB lookup fails?
    }

    // Use the pre-parsed admin emails array from validatedAuthEnv
    // validatedAuthEnv is an object, ADMIN_EMAILS is string[] | undefined
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const adminEmails = validatedAuthEnv.ADMIN_EMAILS ?? [];
    if (user.email && adminEmails.length > 0) {
      token.isAdmin = adminEmails.includes(user.email);
    } else {
      token.isAdmin = false;
    }
  }

  return token;
};

export const sessionCallback = ({ session, token }: { session: Session; token: JWT }): Session => {
  if (token.sub) {
    session.user.id = token.sub; // The user id from the provider
  }
  if (typeof token.dbId === 'number') {
    session.user.dbId = token.dbId; // Our internal DB id
  } else {
    console.warn('[AUTH Session Callback] dbId missing from token. Cannot assign to session.');
    // Potentially fetch from DB here if critical, but adds latency
  }
  if (typeof token.isAdmin === 'boolean') {
    session.user.isAdmin = token.isAdmin;
  }
  if (token.provider) {
    session.user.provider = token.provider;
  }
  return session;
};
