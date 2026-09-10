import type { Config } from 'jest';

const config: Config = {
  displayName: 'invariants',
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/invariants/**/*.invariant-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/support/load-test-environment.ts'],
  testTimeout: 60000,
};

export default config;
