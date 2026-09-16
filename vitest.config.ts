import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'tests/**',           // Node TAP tests (not Vitest)
      '_legacy/**',         // Archived code
      '**/*.spec.js',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
