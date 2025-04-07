import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',

  // Add optional integrations for additional features
  integrations: [Sentry.replayIntegration()],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

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
