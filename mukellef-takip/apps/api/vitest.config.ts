import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Birim testleri: saf iş kuralları, ayrıştırıcılar, platform yardımcıları (altyapı gerektirmez, derleme öncesi kapı).
// Kapsam eşikleri saf katmanlar içindir; düşerse `npm run test:cov` başarısız olur (docs/ai/testing.md).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/domain/**/*.ts', 'src/shared-kernel/**/*.ts', 'src/**/infrastructure/*parser*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/shared-kernel/testing/**'],
      reportsDirectory: './coverage/unit',
      reporter: ['text-summary', 'json'],
      thresholds: { functions: 95, lines: 92, statements: 90, branches: 80 },
    },
  },
});
