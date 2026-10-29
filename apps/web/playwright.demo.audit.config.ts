import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
import base from './playwright.demo.config.ts';
const output = process.env['DEMO_AUDIT_OUTPUT'] ?? resolve(import.meta.dirname, '../../test-results/demo-action-audit');
const channel = process.env['DEMO_AUDIT_BROWSER'] === 'chromium' ? undefined : 'chrome';
// Genel kabul turundan ayrı denetim: varsayılan olarak demo işlem kapsamı ve eksik düğmeler.
// Sadece indirme ortamını ayıran tanı için DEMO_AUDIT_KIND=download kullanılır.
export default defineConfig({ ...base,
  testMatch: process.env['DEMO_AUDIT_KIND'] === 'download' ? /auditDownloadProbe\.audit\.ts$/ : /audit(Actions|Missing)\.audit\.ts$/,
  outputDir: resolve(output, 'screens'), reporter: [['list'], ['junit', { outputFile: resolve(output, 'results.xml') }]],
  use: { ...base.use, baseURL: process.env['TEST_WEB_URL'] ?? 'http://localhost:8080', channel, trace: 'off', acceptDownloads: true, launchOptions: { downloadsPath: resolve(output, 'downloads') } },
  projects: base.projects?.filter(p => p.name === 'laptop').map(p => ({ ...p, use: { ...p.use, channel } })),
});
