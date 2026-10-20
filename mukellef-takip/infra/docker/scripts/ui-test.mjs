#!/usr/bin/env node
// Arayüz regresyon testleri: ayakta olan geliştirme yığınına (Caddy) karşı, telefon / tablet / laptop / büyük ekranda
// her sayfa ve temel kullanıcı akışları (çalışma anı hatası, API 5xx, yatay taşma, kırpılma). Rapor: apps/web/playwright-report
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const run = (args) => spawnSync('docker', args, { stdio: 'inherit', cwd: root }).status ?? 1;

console.log('▶ Arayüz regresyonu (Playwright, 4 ekran boyutu)');
let code = run(['build', '-q', '-f', join(root, 'infra/docker/test.Dockerfile'), '--target', 'ui', '-t', 'mukellef-takip/ui-test:local', root]);
if (code === 0) {
  code = run([
    'run', '--rm', '--network', 'mukellef-takip_edge', '-e', 'UI_BASE_URL=http://caddy:80', '-e', 'CI=1',
    '-v', `${join(root, 'apps/web/playwright-report')}:/app/apps/web/playwright-report`,
    'mukellef-takip/ui-test:local',
  ]);
}
console.log(code === 0 ? '✔ Arayüz testleri başarılı' : '✖ Arayüz testleri başarısız — rapor: apps/web/playwright-report/index.html');
process.exit(code);
