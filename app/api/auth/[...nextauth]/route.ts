import NextAuth from 'next-auth';
// Import the shared options
import { authOptions } from '../../../../lib/authOptions';

// Use the imported options to initialize NextAuth
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const handler = NextAuth(authOptions);

// Export the handler for GET and POST requests as required by Next.js
export { handler as GET, handler as POST };
