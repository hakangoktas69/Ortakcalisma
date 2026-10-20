import { defineConfig } from 'vitest/config';

// Birim testleri: saf satış kuralları (altyapı gerektirmez, derleme öncesi kapı).
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      reportsDirectory: './coverage/unit',
      reporter: ['text-summary', 'json'],
      thresholds: { functions: 95, lines: 92, statements: 90, branches: 80 },
    },
  },
});
