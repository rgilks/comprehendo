import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  // `withAuth` augments your `Request` with the user's token.
  function middleware(req) {
    // Check if the user is an admin
    if (req.nextUrl.pathname.startsWith('/admin') && !req.nextauth.token?.isAdmin) {
      // Redirect non-admins trying to access admin routes to the home page
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Allow the request to proceed if the user is an admin or accessing non-admin routes
    return NextResponse.next();
  },
  {
    callbacks: {
      // Ensure the user is logged in to access any page that matches the matcher
      // (necessary for token to exist)
      authorized: ({ token }) => !!token,
    },
  }
);

// Define which routes the middleware should apply to
export const config = {
  matcher: ['/admin/:path*'], // Protect all routes under /admin
};
