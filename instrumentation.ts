import * as Sentry from '@sentry/nextjs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { nodeProfilingIntegration } = require('@sentry/profiling-node');

    Sentry.init({
      dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',
      integrations: [
        nodeProfilingIntegration(),
        Sentry.consoleIntegration(),
        Sentry.httpIntegration(),
        Sentry.onUncaughtExceptionIntegration(),
        Sentry.onUnhandledRejectionIntegration(),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === 'development',
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version,
      attachStacktrace: true,
      initialScope: {
        tags: {
          'app.name': 'comprehendo',
          'app.type': 'nextjs',
        },
      },
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
