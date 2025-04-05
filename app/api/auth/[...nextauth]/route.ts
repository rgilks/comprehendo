/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import NextAuth from 'next-auth';
import { authOptions } from '../../../../lib/authOptions';

/**
 * For App Router, NextAuth exports an object with route handlers
 * This is the recommended pattern from Next.js documentation
 * @see https://next-auth.js.org/configuration/nextjs#in-app-router
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
