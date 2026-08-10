import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // Component tests (.tsx) run in a real DOM; logic tests (.ts) stay in node.
    environmentMatchGlobs: [
      ['tests/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['tests/setupTests.ts'],
  },
});