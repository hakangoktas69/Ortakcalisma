// Kabul testi: git'in taşımadığı yerel dosyalar eski/ altına gider, çıktılar silinir, eski ayarlar düzeltilir, ikinci çalıştırma boştur.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { planla, uygula } from '../eski-yerel-tasi.mjs';

const yaz = (kok, yol, icerik = 'x') => {
  mkdirSync(join(kok, yol, '..'), { recursive: true });
  writeFileSync(join(kok, yol), icerik);
};

test('eski yollardaki yerel dosyalar taşınır, çıktılar silinir, ayarlar düzeltilir', () => {
  const kok = mkdtempSync(join(tmpdir(), 'eski-tasi-'));
  execFileSync('git', ['init', '-q'], { cwd: kok });
  execFileSync('git', ['config', 'core.hooksPath', 'mukellef-takip/.githooks'], { cwd: kok });
  yaz(kok, 'eski/hakan/mukellef-takip/package.json', '{}'); // pull sonrası izlenen dosya yerinde
  yaz(kok, 'mukellef-takip/.claude/settings.local.json', '{}');
  yaz(kok, 'mukellef-takip/infra/docker/secrets/db.txt');
  yaz(kok, 'mukellef-takip/node_modules/a/index.js');
  yaz(kok, 'mukellef-takip/apps/api/src/generated/prisma.js');
  yaz(kok, 'mukellef-takip/apps/api/tsconfig.tsbuildinfo');
  yaz(kok, 'mert/eworks/robot/jobs/1/status.json');
  yaz(kok, 'hkazaz/docker/mert/.env');
  yaz(kok, '.claude/settings.local.json', JSON.stringify({ autoMemoryDirectory: join(kok, 'mukellef-takip', 'docs', 'ai', 'memory'), permissions: {} }));

  const isler = planla(kok);
  assert.ok(isler.some((i) => i.tur === 'uyar' && i.yol === 'mert/eworks/robot/jobs'), 'jobs/ uyarılır, taşınmaz');
  uygula(kok, isler);

  assert.ok(existsSync(join(kok, 'eski/hakan/mukellef-takip/.claude/settings.local.json')));
  assert.ok(existsSync(join(kok, 'eski/hakan/mukellef-takip/infra/docker/secrets/db.txt')));
  assert.ok(existsSync(join(kok, 'eski/hkazaz/docker/mert/.env')));
  assert.ok(!existsSync(join(kok, 'mukellef-takip')), 'boşalan eski klasör kaldırılır');
  assert.ok(!existsSync(join(kok, 'eski/hakan/mukellef-takip/node_modules')), 'bağımlılıklar taşınmaz');
  assert.ok(!existsSync(join(kok, 'eski/hakan/mukellef-takip/apps/api/src/generated')));
  assert.ok(existsSync(join(kok, 'mert/eworks/robot/jobs/1/status.json')), 'jobs/ --jobs-sil olmadan yerinde kalır');

  const ayar = JSON.parse(readFileSync(join(kok, '.claude/settings.local.json'), 'utf8'));
  assert.equal(ayar.autoMemoryDirectory, join(kok, 'docs', 'ai', 'memory'));
  assert.deepEqual(ayar.permissions, {}, 'kişisel ayarlar korunur');
  const kanca = execFileSync('git', ['config', 'core.hooksPath'], { cwd: kok, encoding: 'utf8' }).trim();
  assert.equal(kanca, 'tools/git-hooks');

  uygula(kok, planla(kok, { jobsSil: true }));
  assert.ok(!existsSync(join(kok, 'mert')), '--jobs-sil ile jobs/ silinir');
  assert.deepEqual(planla(kok), [], 'ikinci çalıştırmada iş kalmaz');
});

test('ilk taşımadan sonra eski/mukellef-takip altında kalan yerel dosyalar eski/hakan/mukellef-takip altına gider', () => {
  const kok = mkdtempSync(join(tmpdir(), 'eski-tasi-'));
  execFileSync('git', ['init', '-q'], { cwd: kok });
  yaz(kok, 'eski/hakan/mukellef-takip/package.json', '{}'); // pull sonrası izlenen dosya yeni yerinde
  yaz(kok, 'eski/mukellef-takip/.claude/settings.local.json', '{}');
  yaz(kok, 'eski/mukellef-takip/infra/docker/secrets/db.txt');
  yaz(kok, 'eski/mukellef-takip/node_modules/a/index.js');
  yaz(kok, 'eski/mukellef-takip/apps/web/.next/x.js');

  uygula(kok, planla(kok));

  assert.ok(existsSync(join(kok, 'eski/hakan/mukellef-takip/.claude/settings.local.json')));
  assert.ok(existsSync(join(kok, 'eski/hakan/mukellef-takip/infra/docker/secrets/db.txt')));
  assert.ok(!existsSync(join(kok, 'eski/hakan/mukellef-takip/node_modules')), 'bağımlılıklar taşınmaz, yeniden kurulur');
  assert.ok(!existsSync(join(kok, 'eski/mukellef-takip')), 'boşalan eski klasör kaldırılır');
  assert.ok(existsSync(join(kok, 'eski/hakan/mukellef-takip/package.json')), 'izlenen dosyalara dokunulmaz');
  assert.deepEqual(planla(kok), [], 'ikinci çalıştırmada iş kalmaz');
});
