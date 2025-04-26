import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const locales = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ru',
  'zh',
  'ja',
  'ko',
  'hi',
  'he',
  'fil',
  'el',
  'pl',
];
const defaultLocale = 'en';

const middleware = async (req: import('next/server').NextRequest) => {
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // --- Bot Filtering ---
  const botUserAgents = [
    'SentryUptimeBot',
    'UptimeRobot',
    'Pingdom',
    'Site24x7',
    'BetterUptime',
    'StatusCake',
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'PetalBot',
    'Bytespider',
  ];

  if (botUserAgents.some((botSubstring) => userAgent.includes(botSubstring))) {
    console.log(`[Middleware] Blocking bot: ${userAgent}. Returning 200 OK.`);
    return new NextResponse(null, { status: 200 });
  }
  // --- End Bot Filtering ---

  const token = await getToken({ req });
  const isAdmin = token?.isAdmin === true;
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');

  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale && !isAdminRoute) {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  try {
    // Enhanced Logging
    const ip = req.headers.get('fly-client-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    console.log(
      `[Middleware] Request: ${req.method} ${pathname} - IP: ${ip} - User-Agent: ${userAgent}`
    );

    // Original Logging
    // console.log(`[Middleware] Path: ${pathname}`);
    console.log(`[Middleware] isAdmin check result: ${isAdmin}`);

    if (isAdminRoute && !isAdmin) {
      console.log(`[Middleware] Redirecting non-admin from /admin to /`);
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${defaultLocale}`;
      return NextResponse.redirect(redirectUrl);
    }
    console.log(`[Middleware] Allowing access to ${pathname}`);
    return NextResponse.next();
  } catch {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
};

export default middleware;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
