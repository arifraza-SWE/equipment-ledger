import type { Config } from 'jest';

const config: Config = {
  displayName: 'e2e',
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/support/load-test-environment.ts'],
  testTimeout: 30000,
};

export default config;
