import { getServerSession } from 'next-auth';

// Use the getServerSession helper for server components
export const getSession = async () => {
  const session = await getServerSession();
  return session;
};

// Re-export everything from next-auth/react for client components
export { useSession, signIn, signOut } from 'next-auth/react';
