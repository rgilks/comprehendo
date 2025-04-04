import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import Sentry from './lib/sentry';
import { getToken } from 'next-auth/jwt';

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  async function middleware(req) {
    const token = await getToken({ req });
    const isAdmin = token?.role === 'admin';
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');

    try {
      // --- BEGIN DEBUG LOGGING ---
      console.log(`[Middleware] Path: ${req.nextUrl.pathname}`);
      console.log(`[Middleware] Token received:`, JSON.stringify(token, null, 2));
      const isAdminCheck = req.nextauth.token?.isAdmin;
      console.log(`[Middleware] isAdmin check result: ${isAdminCheck}`);
      // --- END DEBUG LOGGING ---

      // Check if the user is an admin
      if (isAdminRoute && !isAdmin) {
        // Redirect non-admins trying to access admin routes to the home page
        console.log(`[Middleware] Redirecting non-admin from /admin to /`);
        return NextResponse.redirect(new URL('/', req.url));
      }
      // Allow the request to proceed if the user is an admin or accessing non-admin routes
      console.log(`[Middleware] Allowing access to ${req.nextUrl.pathname}`);
      return NextResponse.next();
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  },
  {
    callbacks: {
      // Ensure the user is logged in to access any page that matches the matcher
      // (necessary for token to exist)
      authorized: async ({ token }) => {
        try {
          // --- BEGIN DEBUG LOGGING (authorized callback) ---
          console.log(`[Middleware Authorized CB] Token received:`, JSON.stringify(token, null, 2));
          const isAuthorized = !!token;
          console.log(`[Middleware Authorized CB] Is authorized (token exists)? ${isAuthorized}`);
          // --- END DEBUG LOGGING (authorized callback) ---
          return isAuthorized;
        } catch (error) {
          Sentry.captureException(error);
          throw error;
        }
      },
    },
  }
);

// Define which routes the middleware should apply to
export const config = {
  matcher: ['/admin/:path*'], // Protect all routes under /admin
};
