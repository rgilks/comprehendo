import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['app/**/*.test.ts'],
    exclude: ['test/e2e/**/*', 'node_modules/**/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['app/**/*.ts'],
      exclude: [
        'app/**/*.test.ts',
        'app/**/*.spec.ts',
        'app/**/*.d.ts',
        'app/**/layout.tsx',
        'app/**/page.tsx',
        'app/**/not-found.tsx',
        'app/**/error.tsx',
        'app/**/loading.tsx',
        'app/components/**/*.tsx',
        'app/api/**/*.ts',
        'app/sw.ts',
        'app/i18n.ts',
        'app/i18n.client.ts',
        'app/middleware.ts',
        'app/globals.css',
      ],
    },
  },
  resolve: {
    alias: {
      app: resolve(__dirname, './app'),
    },
  },
});
