const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [],
  buildExcludes: [/app-build-manifest.json$/],
  publicExcludes: ['!icons/**/*'],
});

const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  distDir: process.env.NEXT_PREVIEW_BUILD === 'true' ? '.next-validation' : '.next',
  async rewrites() {
    return [
      {
        source: '/:lang/icons/:path*',
        destination: '/icons/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        pathname: '**',
      },
    ],
  },
};

const sentryWebpackPluginOptions = {
  // For all available options, see https://github.com/getsentry/sentry-webpack-plugin#options
  org: 'comprehendo',
  project: 'comprehendo',
  // authToken: process.env.SENTRY_AUTH_TOKEN, // Required for source map uploads
  silent: true, // Suppresses build logs
};

// module.exports = withPWA(nextConfig);

// Make sure adding Sentry options is the last code to run before exporting, to
// ensure that your source maps include changes from all other Webpack plugins
module.exports = withSentryConfig(withPWA(nextConfig), sentryWebpackPluginOptions);
