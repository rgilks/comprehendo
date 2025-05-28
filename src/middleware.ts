import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const locales = [
  'zh', // Chinese
  'en', // English
  'fil', // Filipino
  'fr', // French
  'de', // German
  'el', // Greek
  'he', // Hebrew
  'hi', // Hindi
  'it', // Italian
  'ja', // Japanese
  'ko', // Korean
  'pl', // Polish
  'pt', // Portuguese
  'ru', // Russian
  'es', // Spanish
  'th', // Thai
];
const defaultLocale = 'en';

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

const isBotRequest = (userAgent: string | null): boolean => {
  if (!userAgent) return false;
  return botUserAgents.some((botSubstring) => userAgent.includes(botSubstring));
};

const handleBotFiltering = (req: NextRequest): NextResponse | null => {
  const userAgent = req.headers.get('user-agent');
  if (isBotRequest(userAgent)) {
    console.log(`[Middleware] Blocking bot: ${userAgent || 'unknown'}. Returning 200 OK.`);
    return new NextResponse(null, { status: 200 });
  }
  return null;
};

const handleLocaleRedirect = (req: NextRequest): NextResponse | null => {
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
  return null;
};

const handleAdminRoute = (req: NextRequest, isAdmin: boolean): NextResponse | null => {
  const pathname = req.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith('/admin');

  if (isAdminRoute && !isAdmin) {
    console.log(`[Middleware] Redirecting non-admin from /admin to /`);
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(redirectUrl);
  }
  return null;
};

const middleware = async (req: NextRequest) => {
  const botResponse = handleBotFiltering(req);
  if (botResponse) return botResponse;

  const localeRedirectResponse = handleLocaleRedirect(req);
  if (localeRedirectResponse) return localeRedirectResponse;

  const token = await getToken({ req });
  const isAdmin = token?.isAdmin === true;

  const adminRouteResponse = handleAdminRoute(req, isAdmin);
  if (adminRouteResponse) return adminRouteResponse;

  try {
    const ip = req.headers.get('fly-client-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const pathname = req.nextUrl.pathname;
    console.log(
      `[Middleware] Request: ${req.method} ${pathname} - IP: ${ip} - User-Agent: ${userAgent}`
    );
    console.log(`[Middleware] isAdmin check result: ${isAdmin}`);
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
