import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://031c80737e80721d1044ac76d03a0d73@o4509095721566208.ingest.us.sentry.io/4509095722156032',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.npm_package_version,
  ignoreErrors: ['Network request failed', 'Failed to fetch', 'ChunkLoadError'],
});
