const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [], // Add appropriate caching strategies if needed
  buildExcludes: [/app-build-manifest.json$/],
  publicExcludes: ['!icons/**/*'],
});

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  output: 'standalone',
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
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
  eslint: {
    ignoreDuringBuilds: true,
  },
});

module.exports = nextConfig;
