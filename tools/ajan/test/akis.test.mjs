// Kabul testleri — ajanla geliştirme akışının bekçileri (D37, docs/hedef-mimari/09 §8):
// ortak dala doğrudan commit reddi, iş dalındaki değişikliklerden hassas alan tespiti, bitirme metni.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { bitirMetni, degisenDosyalar, durumTopla } from '../bitir.mjs';
import { codeownersMetni, HASSAS_ALANLAR, hassasAlanlar, ortakDalMi } from '../ortak.mjs';
import { yaz } from '../senkron.mjs';

const GERCEK_KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const yazDosya = (kok, yol, icerik) => {
  mkdirSync(dirname(join(kok, yol)), { recursive: true });
  writeFileSync(join(kok, yol), icerik);
};
const g = (kok, ...args) => execFileSync('git', args, { cwd: kok, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function depoKur() {
  const kok = mkdtempSync(join(tmpdir(), 'akis-'));
  g(kok, 'init', '-q', '-b', 'main');
  g(kok, 'config', 'user.name', 'Test');
  g(kok, 'config', 'user.email', 'test@eworks.test');
  g(kok, 'config', 'core.autocrlf', 'false');
  for (const d of ['tools/ajan', 'tools/claude', 'tools/git-hooks']) cpSync(join(GERCEK_KOK, d), join(kok, d), { recursive: true });
  yazDosya(kok, 'CLAUDE.md', '# Proje\n');
  yazDosya(kok, 'docs/ai/memory/MEMORY.md', '');
  yaz(kok, { sahnele: false });
  g(kok, 'add', '-A');
  g(kok, 'commit', '-q', '-m', 'ilk');
  g(kok, 'config', 'core.hooksPath', 'tools/git-hooks');
  return kok;
}

const commit = (kok, mesaj) => spawnSync('git', ['commit', '-q', '-m', mesaj], { cwd: kok, encoding: 'utf8' });

test('ortak dallar tanınır, iş dalı ortak değildir', () => {
  for (const d of ['main', 'master', 'dev', 'yeniden-yapilanma']) assert.ok(ortakDalMi(d), d);
  for (const d of ['is/gorev-logu', 'hakan/satis-modulu', '']) assert.ok(!ortakDalMi(d), d);
});

test('pre-commit kancası ortak dala doğrudan commit’i reddeder, iş dalında izin verir', () => {
  const kok = depoKur();
  yazDosya(kok, 'not.txt', 'a\n');
  g(kok, 'add', '-A');
  const red = commit(kok, 'ortak dala');
  assert.notEqual(red.status, 0, 'main’e commit reddedilmeli');
  assert.match(red.stderr, /ortak dal/i);
  assert.match(red.stderr, /git switch -c <ad>\//);

  g(kok, 'switch', '-q', '-c', 'is/deneme');
  const izin = commit(kok, 'iş dalına');
  assert.equal(izin.status, 0, izin.stderr);
});

test('çakışması çözülen birleştirme commit’i ortak dalda kancaya takılmaz', () => {
  const kok = depoKur();
  g(kok, 'switch', '-q', '-c', 'is/deneme');
  yazDosya(kok, 'a.txt', 'iş dalı\n');
  g(kok, 'add', '-A');
  assert.equal(commit(kok, 'iş').status, 0);
  g(kok, 'switch', '-q', 'main');
  yazDosya(kok, 'a.txt', 'ana dal\n');
  g(kok, 'add', '-A');
  g(kok, '-c', 'core.hooksPath=.git/hooks-yok', 'commit', '-q', '-m', 'ana dalda ilerleme (kancasız)');
  const birlestir = spawnSync('git', ['merge', '-q', 'is/deneme'], { cwd: kok, encoding: 'utf8' });
  assert.notEqual(birlestir.status, 0, 'çakışma bekleniyordu');
  yazDosya(kok, 'a.txt', 'çözüldü\n');
  g(kok, 'add', 'a.txt');
  const sonuc = commit(kok, 'birleştir'); // pre-commit MERGE_HEAD varken çalışır
  assert.equal(sonuc.status, 0, sonuc.stderr);
});

test('hassas alanlar nedenine göre gruplanır; sıradan dosya hassas değildir', () => {
  const sonuc = hassasAlanlar([
    'supabase/migrations/tenant/20261101_0001_x.sql',
    'packages/contexts/credentials/src/domain/a.ts',
    'apps/web/src/bff/oturum.ts',
    'apps/web/package.json',
    'pnpm-lock.yaml',
    'packages/contexts/workspace/src/domain/task.ts',
    'docs/ai/durum.md',
  ]);
  const nedenler = sonuc.map((s) => s.neden);
  assert.ok(nedenler.some((n) => /veritabanı/.test(n)));
  assert.ok(nedenler.some((n) => /kurum şifresi/.test(n)));
  assert.ok(nedenler.some((n) => /oturum/.test(n)));
  const bagimlilik = sonuc.find((s) => /bağımlılık/.test(s.neden));
  assert.deepEqual(bagimlilik?.dosyalar, ['apps/web/package.json', 'pnpm-lock.yaml']);
  const hepsi = sonuc.flatMap((s) => s.dosyalar);
  assert.ok(!hepsi.includes('packages/contexts/workspace/src/domain/task.ts'));
  assert.ok(!hepsi.includes('docs/ai/durum.md'));
});

test('değişen dosyalar: iş dalının commitleri + commitlenmemiş değişiklikler, ortak dallardakiler hariç', () => {
  const kok = depoKur();
  g(kok, 'switch', '-q', '-c', 'is/deneme');
  yazDosya(kok, 'supabase/migrations/tenant/20261101_0001_x.sql', 'select 1;\n');
  g(kok, 'add', '-A');
  assert.equal(commit(kok, 'migration').status, 0);
  yazDosya(kok, 'package.json', '{}\n');
  yazDosya(kok, 'docs/ışık.md', '# Türkçe ad\n');
  const d = degisenDosyalar(kok);
  assert.ok(d.includes('supabase/migrations/tenant/20261101_0001_x.sql'), d.join());
  assert.ok(d.includes('package.json'), d.join());
  assert.ok(d.includes('docs/ışık.md'), d.join());
  assert.ok(!d.includes('CLAUDE.md'), 'ortak daldaki commit sayılmaz');
});

test('ortak dal ref’i hiç yoksa yalnız commitlenmemiş değişiklikler sayılır (tüm geçmiş değil)', () => {
  const kok = depoKur();
  g(kok, 'branch', '-m', 'main', 'develop');
  yazDosya(kok, 'deploy/x.yml', 'a: 1\n');
  const d = degisenDosyalar(kok);
  assert.deepEqual(d, ['deploy/x.yml']);
});

test('ayrık HEAD’de dal boş döner ama hassas alan uyarısı atlanmaz', () => {
  const kok = depoKur();
  g(kok, 'switch', '-q', '-c', 'is/deneme');
  yazDosya(kok, 'supabase/migrations/a.sql', 'select 1;\n');
  g(kok, 'add', '-A');
  assert.equal(commit(kok, 'migration').status, 0);
  g(kok, 'switch', '-q', '--detach', 'HEAD');
  const { dal, hassas } = durumTopla(kok);
  assert.equal(dal, '');
  assert.ok(hassas.some((h) => h.dosyalar.includes('supabase/migrations/a.sql')));
});

test('bekçi kodu, BFF uçları ve işçi de hassas alandır', () => {
  const hepsi = hassasAlanlar([
    'tools/ajan/ortak.mjs',
    'tools/claude/stop-bitir.mjs',
    '.claude/settings.json',
    'apps/web/src/app/api/gorevler/route.ts',
    'apps/worker/src/uygulayici.ts',
  ]).flatMap((s) => s.dosyalar);
  assert.equal(hepsi.length, 5, hepsi.join());
});

test('CODEOWNERS hassas alan listesinden üretilir; her yol kod sahibine bağlı', () => {
  const metin = codeownersMetni();
  for (const a of HASSAS_ALANLAR) for (const y of a.yollar) assert.match(metin, new RegExp(`^${(y.startsWith('**/') ? y : `/${y}`).replace(/[.*]/g, '\\$&')} @hkazaz$`, 'm'), y);
  assert.match(metin, /Üretilir/);
});

test('bitirme metni ortak dal ve hassas alan uyarısı, bağımsız inceleme ve dev birleştirme adımı içerir', () => {
  const ortak = bitirMetni('claude', {
    senkron: 'güncel',
    hafiza: 'yeşil',
    dal: 'yeniden-yapilanma',
    hassas: [{ neden: 'veritabanı şeması, RLS', dosyalar: ['supabase/migrations/tenant/a.sql'] }],
  });
  assert.match(ortak, /ortak daldasın/i);
  assert.match(ortak, /git switch -c <ad>\//);
  assert.match(ortak, /Kıdemli onayı/);
  assert.match(ortak, /@hkazaz/);
  assert.match(ortak, /supabase\/migrations\/tenant\/a\.sql/);
  assert.match(ortak, /code-review/);
  assert.match(ortak, /birlestir\.mjs guncelle/);

  const temiz = bitirMetni('codex', { senkron: 'güncel', hafiza: 'yeşil', dal: 'is/x', hassas: [] });
  assert.doesNotMatch(temiz, /ortak daldasın/i);
  assert.doesNotMatch(temiz, /Kıdemli onayı gerekli/);
  assert.match(temiz, /\/review/);
});
