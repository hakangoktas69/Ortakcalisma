import { defineConfig } from 'vitest/config';

// Tek koşucu: bağlam paketleri, çekirdek, özellik kaydı ve araçlar. Testler @F:<anahtar> / [F:<anahtar>] ile özelliğe bağlanır.
export default defineConfig({
  test: {
    include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts', 'tools/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      // 06 §7.2: domain + application %90 satır / %80 dal; eşik düşürülmez
      thresholds: { lines: 90, branches: 80 },
    },
  },
});
