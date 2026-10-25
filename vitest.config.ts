import { defineConfig } from 'vitest/config';

// İki proje: birim (bağımlılıksız, her yerde) ve entegrasyon (*.int.test.ts — gerçek Postgres/Redis/RabbitMQ/S3/GoTrue;
// `node tools/deploy/yigin.mjs test` yığının ağında koşturur). Testler @F:<anahtar> / [F:<anahtar>] ile özelliğe bağlanır.
const ortak = ['**/node_modules/**', 'eski/**', 'apps/web/e2e/**', 'apps/web/.next/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'birim',
          include: ['packages/**/test/**/*.test.ts', 'apps/**/test/**/*.test.ts', 'apps/**/src/**/*.test.ts', 'tools/**/*.test.ts'],
          exclude: [...ortak, '**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'entegrasyon',
          include: ['**/*.int.test.ts'],
          exclude: ortak,
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      // 06 §7.2: domain + application %90 satır / %80 dal; eşik düşürülmez
      thresholds: { lines: 90, branches: 80 },
    },
  },
});
