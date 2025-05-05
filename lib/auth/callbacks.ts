import { User, Account, Session } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import { JWT } from 'next-auth/jwt';
import { validatedAuthEnv } from '../config/authEnv';
import { upsertUserOnSignIn, findUserByProvider } from '../repositories/userRepository';

export interface UserWithEmail extends User {
  email?: string | null;
}

export const signInCallback = ({
  user,
  account,
}: {
  user: User | AdapterUser;
  account: Account | null;
}): boolean => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (account && user) {
    try {
      // Rely solely on the repository function for upsert logic and error handling.
      upsertUserOnSignIn(user, account);
      return true; // Sign-in allowed if upsert succeeds
    } catch (error) {
      console.error(
        '[AUTH SignIn Callback] Error during sign in process (upsertUserOnSignIn failed):',
        error
      );
      // Prevent sign-in if the database operation fails
      return false;
    }
  } else {
    // Log if essential account or user info is missing for the upsert operation.
    // Depending on the provider flow, this might indicate an issue or be expected.
    console.warn('[AUTH SignIn Callback] Missing account or user object. Skipping DB upsert.');
    // Allow sign-in even if we skipped the DB operation?
    // Or return false? Returning true for now, assuming sign-in should proceed.
    return true;
  }
  // Original direct DB logic removed.
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
    }

    const adminEmails = validatedAuthEnv.ADMIN_EMAILS;
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
