import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Gerçek veritabanı ve container'lar: testler sıralı, süreler uzun
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
