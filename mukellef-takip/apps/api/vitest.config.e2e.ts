import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Regresyon (uçtan uca) testleri: gerçek PostgreSQL (RLS) + Redis, gerçek Nest uygulaması.
// Yığın test/support/global-setup.ts'te bir kez kurulur; her dosya kendi uygulamasını başlatır.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    // Dosyalar aynı veritabanını paylaşır: sıralı çalışır
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 240_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.spec.ts', 'src/main.ts', 'src/worker.ts'],
      reportsDirectory: './coverage/e2e',
      reporter: ['text-summary', 'json'],
      // Uygulama + altyapı katmanları gerçek veritabanıyla çalıştırılarak ölçülür; düşerse kapı kapanır
      thresholds: { functions: 90, lines: 87, statements: 82, branches: 60 },
    },
  },
});
