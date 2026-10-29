import { defineConfig } from '@playwright/test';

// Asıl özelliklerin kabul testlerinden ayrıdır: demo canlandırmaları canlı özellikleri yeşile çevirmez.
export default defineConfig({
  testDir: './demo-e2e', testMatch: /.*\.e2e\.ts$/, workers: 2, retries: 0, timeout: 180_000,
  reporter: [['list'], ['junit', { outputFile: '../../test-results/demo-e2e.xml' }]],
  outputDir: '../../test-results/demo-e2e-ciktilar',
  use: { baseURL: process.env['TEST_WEB_URL'] ?? 'http://localhost:8080', locale: 'tr-TR', timezoneId: 'Europe/Istanbul', trace: 'retain-on-failure', actionTimeout: 10000 },
  projects: [
    { name: 'telefon', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'laptop', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'genis', use: { viewport: { width: 1920, height: 1080 } } },
  ],
});
