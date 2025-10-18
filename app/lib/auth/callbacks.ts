import { User, Account, Session } from 'next-auth';
import { AdapterUser } from 'next-auth/adapters';
import { JWT } from 'next-auth/jwt';
import { validatedAuthEnv } from 'app/lib/config/authEnv';
import { upsertUserOnSignIn, findUserByProvider } from 'app/repo/userRepo';

export interface UserWithEmail extends User {
  email?: string | null;
}

export const signInCallback = async ({
  user,
  account,
}: {
  user: User | AdapterUser;
  account: Account | null;
}): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (account && user) {
    try {
      await upsertUserOnSignIn(user, account);
      return true;
    } catch (error) {
      console.error(
        '[AUTH SignIn Callback] Error during sign in process (upsertUserOnSignIn failed):',
        error
      );
      return false;
    }
  } else {
    console.warn('[AUTH SignIn Callback] Missing account or user object. Skipping DB upsert.');
    return true;
  }
};

export const jwtCallback = async ({
  token,
  user,
  account,
}: {
  token: JWT;
  user?: UserWithEmail;
  account?: Account | null;
}): Promise<JWT> => {
  if (account && user?.id && user.email) {
    token.provider = account.provider;
    token.email = user.email;

    try {
      const userRecord = await findUserByProvider(user.id, account.provider);

      if (userRecord) {
        token.dbId = userRecord.id;
      } else {
        console.error(
          `[AUTH JWT Callback] CRITICAL: Could not find user in DB during JWT creation for provider_id=${user.id}, provider=${account.provider}. dbId will be missing!`
        );
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
    session.user.id = token.sub;
  }
  if (typeof token.dbId === 'number') {
    session.user.dbId = token.dbId;
  } else {
    console.warn('[AUTH Session Callback] dbId missing from token. Cannot assign to session.');
  }
  if (typeof token.isAdmin === 'boolean') {
    session.user.isAdmin = token.isAdmin;
  }
  if (token.provider) {
    session.user.provider = token.provider;
  }
  return session;
};
