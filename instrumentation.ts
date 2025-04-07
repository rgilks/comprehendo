import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version,
    });
  }
}

export function onRequestError(error: Error, request: Request, response: Response) {
  Sentry.withScope((scope) => {
    scope.setExtra('request', {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });
    scope.setExtra('response', {
      status: response.status,
      statusText: response.statusText,
    });
    Sentry.captureException(error);
  });
}
