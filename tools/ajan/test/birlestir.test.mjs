// Kabul testleri — kişisel dalı dev'e birleştirme (D37, tools/ajan/birlestir.mjs).
// Her test geçici bir uzak depo (bare), çalışan klon ve dev'e iş gönderen ikinci bir klonla çalışır.
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { yaz } from '../senkron.mjs';

const GERCEK_KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const g = (kok, ...args) => execFileSync('git', args, { cwd: kok, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const yazDosya = (kok, yol, icerik) => {
  mkdirSync(dirname(join(kok, yol)), { recursive: true });
  writeFileSync(join(kok, yol), icerik);
};
const kimlik = (kok) => {
  g(kok, 'config', 'user.name', 'Test');
  g(kok, 'config', 'user.email', 'test@eworks.test');
  g(kok, 'config', 'core.autocrlf', 'false');
};
const commitle = (kok, yol, icerik, mesaj) => {
  yazDosya(kok, yol, icerik);
  g(kok, 'add', '-A');
  g(kok, 'commit', '-q', '-m', mesaj);
};
const birlestir = (kok, ...args) =>
  spawnSync(process.execPath, [join(kok, 'tools/ajan/birlestir.mjs'), ...args], { cwd: kok, encoding: 'utf8' });

function ortamKur() {
  const uzak = mkdtempSync(join(tmpdir(), 'birlestir-uzak-'));
  g(uzak, 'init', '-q', '--bare', '-b', 'main');
  const kok = mkdtempSync(join(tmpdir(), 'birlestir-'));
  g(kok, 'init', '-q', '-b', 'main');
  kimlik(kok);
  for (const d of ['tools/ajan', 'tools/claude', 'tools/git-hooks']) cpSync(join(GERCEK_KOK, d), join(kok, d), { recursive: true });
  yazDosya(kok, 'CLAUDE.md', '# Proje\n');
  yazDosya(kok, 'docs/ai/memory/MEMORY.md', '');
  yazDosya(kok, 'ortak.txt', 'ilk\n');
  yaz(kok, { sahnele: false });
  g(kok, 'add', '-A');
  g(kok, 'commit', '-q', '-m', 'ilk');
  g(kok, 'remote', 'add', 'origin', uzak);
  g(kok, 'push', '-q', 'origin', 'main');
  g(kok, 'push', '-q', 'origin', 'main:dev');
  g(kok, 'fetch', '-q', 'origin');
  g(kok, 'config', 'core.hooksPath', 'tools/git-hooks');
  g(kok, 'switch', '-q', '-c', 'hakan/is', 'origin/dev');

  // Ekip arkadaşı: dev'e doğrudan iş gönderir (kancasız klon)
  const mert = mkdtempSync(join(tmpdir(), 'birlestir-mert-'));
  g(mert, 'clone', '-q', '-b', 'dev', uzak, '.');
  kimlik(mert);
  const mertGonder = (yol, icerik, mesaj) => {
    commitle(mert, yol, icerik, mesaj);
    g(mert, 'push', '-q', 'origin', 'dev');
  };
  return { kok, uzak, mertGonder };
}

test('guncelle: çatışmasız dev güncellemesi kişisel dala alınır, yeniden doğrulama hatırlatılır', () => {
  const { kok, mertGonder } = ortamKur();
  commitle(kok, 'benim.txt', 'iş\n', 'benim işim');
  mertGonder('mert.txt', 'mert\n', 'Mert: e-Defter hazırlığı');
  const r = birlestir(kok, 'guncelle');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(existsSync(join(kok, 'mert.txt')));
  assert.match(r.stdout, /Mert: e-Defter hazırlığı/);
  assert.match(r.stdout, /doğrulamaları yeniden koş/i);
  assert.equal(g(kok, 'symbolic-ref', '--short', 'HEAD').trim(), 'hakan/is');
});

test('guncelle: çatışmada dosyayı ve iki tarafın commitlerini listeler, birleşmeyi açık bırakır', () => {
  const { kok, mertGonder } = ortamKur();
  commitle(kok, 'ortak.txt', 'benim sürümüm\n', 'Hakan: görev başlığı zorunlu');
  mertGonder('ortak.txt', 'mert sürümü\n', 'Mert: görev başlığı 200 karakter');
  const r = birlestir(kok, 'guncelle');
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /ortak\.txt/);
  assert.match(r.stdout, /Hakan: görev başlığı zorunlu/);
  assert.match(r.stdout, /Mert: görev başlığı 200 karakter/);
  assert.match(r.stdout, /git merge --abort/);
  assert.ok(existsSync(join(kok, '.git/MERGE_HEAD')), 'birleşme çözüm için açık kalmalı');
});

test('guncelle: üretilen dosyadaki çatışma elle değil yeniden üretimle çözülür', () => {
  const { kok, mertGonder } = ortamKur();
  commitle(kok, 'pnpm-lock.yaml', 'a: 1\n', 'kilit benim');
  mertGonder('pnpm-lock.yaml', 'a: 2\n', 'kilit mert');
  const r = birlestir(kok, 'guncelle');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /pnpm-lock\.yaml.*yeniden üret/);
});

test('guncelle ve dev: ortak dalda ya da commitlenmemiş değişiklikle çalışmaz', () => {
  const { kok } = ortamKur();
  yazDosya(kok, 'yarim.txt', 'x\n');
  const kirli = birlestir(kok, 'guncelle');
  assert.notEqual(kirli.status, 0);
  assert.match(kirli.stderr, /commitle/);
  g(kok, 'stash', '-q', '-u');
  g(kok, 'switch', '-q', '-c', 'dev', 'origin/dev');
  const ortak = birlestir(kok, 'dev', '--mesaj', 'x');
  assert.notEqual(ortak.status, 0);
  assert.match(ortak.stderr, /ortak dal/);
});

test('dev: dev’in son hali kişisel dalda yoksa reddeder ve önce guncelle der', () => {
  const { kok, mertGonder } = ortamKur();
  commitle(kok, 'benim.txt', 'iş\n', 'benim işim');
  mertGonder('mert.txt', 'mert\n', 'Mert işi');
  const r = birlestir(kok, 'dev', '--mesaj', 'Görev logu');
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /guncelle/);
});

test('dev: güncel kişisel dal dev’e --no-ff birleşir, push edilmez, kişisel dala dönülür; hassas alan mesaja eklenir', () => {
  const { kok, uzak, mertGonder } = ortamKur();
  mertGonder('mert.txt', 'mert\n', 'Mert işi');
  commitle(kok, 'supabase/migrations/tenant/a.sql', 'select 1;\n', 'migration');
  assert.equal(birlestir(kok, 'guncelle').status, 0);
  const uzakOnce = g(uzak, 'rev-parse', 'dev').trim();

  const r = birlestir(kok, 'dev', '--mesaj', 'Görev logu eklendi\n\nA/B/C özeti');
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /git push origin dev/);
  assert.equal(g(kok, 'symbolic-ref', '--short', 'HEAD').trim(), 'hakan/is');
  assert.equal(g(uzak, 'rev-parse', 'dev').trim(), uzakOnce, 'push edilmemeli');

  const ebeveyn = g(kok, 'rev-list', '--parents', '-n', '1', 'dev').trim().split(' ');
  assert.equal(ebeveyn.length, 3, 'birleştirme commit’i (--no-ff)');
  const mesaj = g(kok, 'log', '-1', '--format=%B', 'dev');
  assert.match(mesaj, /^Görev logu eklendi/);
  assert.match(mesaj, /Kıdemli onayı gerekli \(@hkazaz\)/);
  assert.match(mesaj, /supabase\/migrations\/tenant\/a\.sql/);
  assert.ok(!readFileSync(join(kok, '.git/HEAD'), 'utf8').includes('refs/heads/dev'));
});
