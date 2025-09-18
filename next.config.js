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
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*; font-src 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; media-src 'self' data:; connect-src 'self' https://*.google.com https://*.googleapis.com data:;",
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
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['.', 'app', 'components', 'lib'],
  },
};

let withCloudflare = (config) => config;

const adapterSpecifiers = [
  '@opennextjs/cloudflare/next-config',
  '@opennextjs/cloudflare',
  '@cloudflare/next-on-pages/next-config',
];

for (const specifier of adapterSpecifiers) {
  try {
    const module = await import(specifier);
    const candidate = module?.withCloudflare ?? module?.default?.withCloudflare;
    if (typeof candidate === 'function') {
      withCloudflare = candidate;
      break;
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[next.config.js] Unable to load Cloudflare adapter from "${specifier}". Install @opennextjs/cloudflare to enable Cloudflare-specific optimisations.`,
        error
      );
    }
  }
}

export default withCloudflare(withSerwist(nextConfig));
