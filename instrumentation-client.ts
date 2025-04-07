import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',

  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',

  // Session Replay
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    // Browser tracing
    Sentry.browserTracingIntegration(),
    // Capture breadcrumbs
    Sentry.breadcrumbsIntegration(),
  ],

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.npm_package_version,

  // Enable source maps
  attachStacktrace: true,

  // Custom tags for better filtering
  initialScope: {
    tags: {
      'app.name': 'comprehendo',
      'app.type': 'nextjs',
    },
  },

  // Ignore specific errors
  ignoreErrors: [
    // Ignore specific error messages
    'Network request failed',
    'Failed to fetch',
    // Ignore specific error types
    'ChunkLoadError',
  ],

  // Customize error grouping
  beforeSend(event) {
    // Add custom fingerprinting for better error grouping
    if (event.exception?.values?.[0]) {
      const error = event.exception.values[0];
      event.fingerprint = [
        '{{ default }}',
        error.type || 'UnknownError',
        error.value || 'Unknown error message',
      ];
    }
    return event;
  },
});
