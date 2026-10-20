import { defineConfig } from 'vitest/config';

// Uçtan uca: gerçek PostgreSQL (migration'lar, satış rolü, RLS) + gerçek Nest uygulaması.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
  },
});
