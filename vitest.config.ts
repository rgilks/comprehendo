import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['app/**/*.test.ts'],
    exclude: ['test/e2e/**/*', 'node_modules/**/*'],
  },
  resolve: {
    alias: {
      app: resolve(__dirname, './app'),
    },
  },
});
