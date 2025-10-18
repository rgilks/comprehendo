import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  register: true,
  disable: process.env.NODE_ENV !== 'production',
  exclude: [(filePath) => /app-build-manifest.json$/.test(filePath)],
});

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value:
              process.env.NODE_ENV === 'development'
                ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://github.com https://cdn.discordapp.com https://storage.ko-fi.com; font-src 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; media-src 'self' data:; connect-src 'self' https://*.google.com https://*.googleapis.com data:;"
                : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://github.com https://cdn.discordapp.com https://storage.ko-fi.com; font-src 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; media-src 'self' data:; connect-src 'self' https://*.google.com https://*.googleapis.com data:;",
          },
        ],
      },
    ];
  },
  rewrites: async () => {
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
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'storage.ko-fi.com',
        pathname: '**',
      },
      {
        protocol: 'https',
        hostname: 'example.com',
        pathname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['.', 'app', 'components', 'lib'],
  },
};

export default withSerwist(nextConfig);
