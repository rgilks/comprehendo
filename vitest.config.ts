import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      'test/e2e/**',
      'public/**',
      '**/*.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['app/**/*.{js,jsx,ts,tsx}', 'lib/**/*.{js,jsx,ts,tsx}', 'middleware.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
        '**/*.config.js',
        '**/*.config.cjs',
        '**/*.config.ts',
        '**/*.d.ts',

        'test/e2e/**',
        'public/**',
        'coverage/**',
        '.next/**',
        '.next-validation/**',
        'playwright-report/**',
        'test-results/**',

        'vitest.setup.ts',
        'lib/__mocks__/**',
        '**/__generated__/**',
      ],
    },
  },
});
