import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const locales = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'hi', 'he', 'fil'];
const defaultLocale = 'en';

const middleware = async (req: import('next/server').NextRequest) => {
  const token = await getToken({ req });
  const isAdmin = token?.isAdmin === true;
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');
  const isSentryPageRoute = pathname.startsWith('/sentry-example-page');

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale && !isAdminRoute && !isSentryPageRoute) {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  try {
    console.log(`[Middleware] Path: ${pathname}`);
    console.log(`[Middleware] isAdmin check result: ${isAdmin}`);

    if (isAdminRoute && !isAdmin) {
      console.log(`[Middleware] Redirecting non-admin from /admin to /`);
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${defaultLocale}`;
      return NextResponse.redirect(redirectUrl);
    }
    console.log(`[Middleware] Allowing access to ${pathname}`);
    return NextResponse.next();
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
};

export default middleware;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
