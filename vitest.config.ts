import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    alias: {
      '@shared': path.resolve(__dirname, 'dashboard/src/shared'),
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'dashboard/src/shared'),
    },
  },
});
