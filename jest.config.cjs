/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Mock ESM-only packages that use package.json exports/imports (unsupported in Jest)
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.cjs',
    '^ora$': '<rootDir>/tests/__mocks__/ora.cjs',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'node',
          target: 'ES2022',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
          skipLibCheck: true,
          noUnusedLocals: false,
          noUnusedParameters: false,
          noImplicitReturns: false,
        },
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverageFrom: [
    'src/server/**/*.ts',
    '!src/server/**/*.md',
  ],
};
