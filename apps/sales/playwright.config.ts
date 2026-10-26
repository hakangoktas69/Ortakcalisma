import { defineConfig, devices } from '@playwright/test';

// Satış portalı kabul testleri (06 §7.2): yığına karşı, dört ekran sınıfında. Test adları @F:<anahtar> taşır; JUnit çıktısı
// test-results/e2e-satis.xml — özellik durumu e2e*.xml'i kabul testi sayar. Çalıştırma: node tools/deploy/yigin.mjs e2e
const ekran = (name: string, width: number, height: number, mobil = false) => ({
  name,
  use: { ...devices['Desktop Chrome'], viewport: { width, height }, isMobile: mobil, hasTouch: mobil },
});

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 2,
  retries: 0,
  timeout: 90_000,
  reporter: [['list'], ['junit', { outputFile: '../../test-results/e2e-satis.xml' }]],
  use: {
    baseURL: process.env['TEST_SATIS_URL'] ?? 'http://localhost:8081',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
  },
  outputDir: '../../test-results/e2e-satis-ciktilar',
  projects: [ekran('telefon', 375, 812, true), ekran('tablet', 768, 1024, true), ekran('laptop', 1366, 768), ekran('genis', 1920, 1080)],
});
