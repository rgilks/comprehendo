import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    // --- BEGIN DEBUG LOGGING ---
    console.log(`[Middleware] Path: ${req.nextUrl.pathname}`);
    console.log(`[Middleware] Token received:`, JSON.stringify(req.nextauth.token, null, 2));
    const isAdminCheck = req.nextauth.token?.isAdmin;
    console.log(`[Middleware] isAdmin check result: ${isAdminCheck}`);
    // --- END DEBUG LOGGING ---

    // Check if the user is an admin
    if (req.nextUrl.pathname.startsWith('/admin') && !isAdminCheck) {
      // Redirect non-admins trying to access admin routes to the home page
      console.log(`[Middleware] Redirecting non-admin from /admin to /`);
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Allow the request to proceed if the user is an admin or accessing non-admin routes
    console.log(`[Middleware] Allowing access to ${req.nextUrl.pathname}`);
    return NextResponse.next();
  },
  {
    callbacks: {
      // Ensure the user is logged in to access any page that matches the matcher
      // (necessary for token to exist)
      authorized: ({ token }) => {
        // --- BEGIN DEBUG LOGGING (authorized callback) ---
        console.log(`[Middleware Authorized CB] Token received:`, JSON.stringify(token, null, 2));
        const isAuthorized = !!token;
        console.log(`[Middleware Authorized CB] Is authorized (token exists)? ${isAuthorized}`);
        // --- END DEBUG LOGGING (authorized callback) ---
        return isAuthorized;
      },
    },
  }
);

// Define which routes the middleware should apply to
export const config = {
  matcher: ['/admin/:path*'], // Protect all routes under /admin
};
