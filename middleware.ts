import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import Sentry from './lib/sentry';
import { getToken } from 'next-auth/jwt';

const locales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
const defaultLocale = 'en';

export default withAuth(
  async function middleware(req) {
    const token = await getToken({ req });
    const isAdmin = token?.isAdmin === true;
    const isAdminRoute = req.nextUrl.pathname.startsWith('/admin');
    const pathname = req.nextUrl.pathname;

    // Handle language routing
    const pathnameIsMissingLocale = locales.every(
      (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
    );

    if (pathnameIsMissingLocale) {
      const locale = req.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url));
    }

    // Handle admin authentication
    try {
      console.log(`[Middleware] Path: ${pathname}`);
      // console.log(`[Middleware] Token received:`, JSON.stringify(token, null, 2));
      const isAdminCheck = req.nextauth.token?.isAdmin;
      console.log(`[Middleware] isAdmin check result: ${isAdminCheck}`);

      if (isAdminRoute && !isAdmin) {
        console.log(`[Middleware] Redirecting non-admin from /admin to /`);
        return NextResponse.redirect(new URL('/', req.url));
      }
      console.log(`[Middleware] Allowing access to ${pathname}`);
      return NextResponse.next();
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  },
  {
    callbacks: {
      authorized: async ({ token }) => {
        try {
          // console.log(`[Middleware Authorized CB] Token received:`, JSON.stringify(token, null, 2));
          const isAuthorized = !!token;
          console.log(`[Middleware Authorized CB] Is authorized (token exists)? ${isAuthorized}`);
          return isAuthorized;
        } catch (error) {
          Sentry.captureException(error);
          throw error;
        }
      },
    },
  }
);

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
