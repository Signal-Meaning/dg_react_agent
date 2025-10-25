module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx',
    '<rootDir>/test-app/tests/**/*.test.js',
    '<rootDir>/test-app/tests/**/*.test.ts',
    '<rootDir>/test-app/tests/**/*.test.tsx',
    '!<rootDir>/test-app/tests/e2e/**/*' // Exclude test-app E2E tests
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/test-app/**/*'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Handle test-app ES modules by transforming them
  transformIgnorePatterns: [
    'node_modules/(?!(test-app)/)'
  ],
  // Use CommonJS for all tests to avoid ES module conflicts
  extensionsToTreatAsEsm: [],
  globals: {
    'ts-jest': {
      useESM: false
    }
  }
};
