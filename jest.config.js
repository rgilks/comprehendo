// Jest configuration for Next.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases (if you have configured them in Next.js)
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/mocks/',
  ],
  // Add more setup options before each test is run
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/mocks/',
  ],
  transform: {
    // Use ts-jest to handle TypeScript files
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
      },
    ],
  },
  // Don't consider mock files as test files
  testMatch: ['**/__tests__/**/*test.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  // Allow ESM modules in node_modules
  transformIgnorePatterns: [
    // Transform ESM modules that Jest doesn't handle natively
    'node_modules/(?!(next|next-auth|jose|openid-client|@panva|oidc-token-hash)/)',
  ],
  // Use for test isolation between files
  resetMocks: true,
  clearMocks: true,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
