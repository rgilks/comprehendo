import { NextResponse } from 'next/server';
import Sentry from './lib/sentry';
import { getToken } from 'next-auth/jwt';

const locales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
const defaultLocale = 'en';

export default async function middleware(req: import('next/server').NextRequest) {
  const token = await getToken({ req });
  const isAdmin = token?.isAdmin === true;
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin'); // Check early

  // Handle language routing
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // Redirect only if locale is missing AND it's NOT the admin route
  if (pathnameIsMissingLocale && !isAdminRoute) {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    // Ensure query parameters are preserved during redirect
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Handle admin authentication
  try {
    console.log(`[Middleware] Path: ${pathname}`);
    // console.log(`[Middleware] Token received:`, JSON.stringify(token, null, 2));
    // Use the already fetched token's isAdmin property
    console.log(`[Middleware] isAdmin check result: ${isAdmin}`);

    // If it's an admin route but the user is not an admin, redirect to home with locale
    if (isAdminRoute && !isAdmin) {
      console.log(`[Middleware] Redirecting non-admin from /admin to /`);
      // Redirect to the root with the *default* locale, as /admin won't have one
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${defaultLocale}`; // Redirect to default locale root
      return NextResponse.redirect(redirectUrl);
    }
    console.log(`[Middleware] Allowing access to ${pathname}`);
    return NextResponse.next(); // Allow access if admin or not an admin route
  } catch (error) {
    Sentry.captureException(error);
    // It's generally better to return a response than re-throwing in middleware
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'], // Adjusted matcher slightly
};
