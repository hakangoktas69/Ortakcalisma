import { defineConfig } from '@playwright/test';
import base from './playwright.demo.config.ts';
// Yerel Docker test bağlantısı erişilemediğinde aynı demo testlerini ayrı headless Chrome ile koşar.
export default defineConfig({ ...base, testMatch: /^(?!.*auditActions).*\.e2e\.ts$/, outputDir: '../../test-results/demo-audit-local/screens', reporter: [['list'], ['junit', { outputFile: '../../test-results/demo-audit-local/results.xml' }]],
  use: { ...base.use, baseURL: 'http://localhost:8080', channel: 'chrome' },
  projects: base.projects?.map(project => ({ ...project, use: { ...project.use, channel: 'chrome' } })),
});
