import * as Sentry from '@sentry/nextjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',
  integrations: [
    nodeProfilingIntegration(),
    Sentry.consoleIntegration(),
    Sentry.httpIntegration(),
    Sentry.onUncaughtExceptionIntegration(),
    Sentry.onUnhandledRejectionIntegration(),
  ],
  // Performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',
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
});
