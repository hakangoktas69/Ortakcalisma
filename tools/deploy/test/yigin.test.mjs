// Yerel geliştirme yolu (Docker'sız web): geliştirme katmanı yalnız 127.0.0.1'e açılır, web ortam dosyası doğru üretilir.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { composeDosyalari, GELISTIRME_PORTLARI, webEnv } from '../yigin.mjs';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SIRLAR = {
  POSTGRES_PASSWORD: 'superkullanici', CONTROL_DB_PASSWORD: 'kontrol', APP_DB_PASSWORD: 'uygulama', JWT_SECRET: 'j'.repeat(40),
  SESSION_SECRET: 's'.repeat(40), TAX_ID_HMAC_KEY: 'h'.repeat(40), REDIS_PASSWORD: 'redisparola', S3_ACCESS_KEY: 'erisim', S3_SECRET_KEY: 'gizli',
};
const satirlar = (metin) => Object.fromEntries(metin.split('\n').filter((s) => /^[A-Z0-9_]+=/.test(s)).map((s) => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]));

test('web ortam dosyası yığına yalnız 127.0.0.1 üzerinden bağlanır, geliştirme kipindedir', () => {
  const e = satirlar(webEnv(SIRLAR));
  assert.equal(e.EWORKS_ORTAM, 'gelistirme');
  assert.equal(e.COOKIE_SECURE, 'false');
  assert.equal(e.CONTROL_DATABASE_URL, `postgres://eworks_control:kontrol@127.0.0.1:${GELISTIRME_PORTLARI.dbControl}/postgres`);
  assert.equal(e.SHARD_DATABASE_URLS,
    `shard-01=postgres://eworks_app:uygulama@127.0.0.1:${GELISTIRME_PORTLARI.dbShard01}/postgres,shard-02=postgres://eworks_app:uygulama@127.0.0.1:${GELISTIRME_PORTLARI.dbShard02}/postgres`);
  assert.equal(e.AUTH_URL, `http://127.0.0.1:${GELISTIRME_PORTLARI.auth}`);
  assert.equal(e.REDIS_URL, `redis://:redisparola@127.0.0.1:${GELISTIRME_PORTLARI.redis}/0`);
  assert.equal(e.S3_ENDPOINT, `http://127.0.0.1:${GELISTIRME_PORTLARI.s3}`);
  for (const k of ['JWT_SECRET', 'SESSION_SECRET', 'TAX_ID_HMAC_KEY', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) assert.equal(e[k], SIRLAR[k], k);
  assert.ok(!Object.values(e).some((v) => v.includes('superkullanici')), 'web süper kullanıcı parolasını görmez');
  assert.match(webEnv(SIRLAR), /commit etmeyin/);
});

test('portlar ve adresler değiştirilebilir (çakışma ve container içi doğrulama için)', () => {
  const e = satirlar(webEnv(SIRLAR, { adres: (servis) => `${servis}`, portlar: { dbControl: 5432, dbShard01: 5432, dbShard02: 5432, auth: 9999, redis: 6379, s3: 8333 } }));
  assert.equal(e.CONTROL_DATABASE_URL, 'postgres://eworks_control:kontrol@db-control:5432/postgres');
  assert.equal(e.AUTH_URL, 'http://auth:9999');
});

test('geliştirme katmanı portları yalnız 127.0.0.1 e açar; ağa açık port yok', () => {
  const yml = readFileSync(join(KOK, 'deploy/compose/compose.gelistirme.yml'), 'utf8');
  const portlar = [...yml.matchAll(/^\s*-\s*['"]?([^'"\n]+)['"]?\s*$/gm)].map((m) => m[1]).filter((p) => /:\d+$/.test(p));
  assert.equal(portlar.length, 6, portlar.join(' | '));
  for (const p of portlar) assert.match(p, /^127\.0\.0\.1:/, p);
  for (const s of ['db-control', 'db-shard-01', 'db-shard-02', 'auth', 'redis', 's3']) assert.match(yml, new RegExp(`^  ${s}:`, 'm'), s);
});

test('web geliştirme sunucusu 8765 portunda ve yalnız yerelde dinler (Eworks 2 portal adresi)', () => {
  const p = JSON.parse(readFileSync(join(KOK, 'apps/web/package.json'), 'utf8'));
  assert.equal(p.scripts.dev, 'next dev -p 8765 -H 127.0.0.1');
});

test('next dev AGENTS.md üretmez (ajan bağlamı tek kaynaktan: tools/ajan/senkron.mjs)', () => {
  assert.match(readFileSync(join(KOK, 'apps/web/next.config.ts'), 'utf8'), /^\s*agentRules: false,/m);
});

test('eksik sır ya da geçersiz port varsa ortam dosyası yazılmaz; boş port varsayılana döner', () => {
  const { JWT_SECRET: _yok, ...eksik } = SIRLAR;
  assert.throws(() => webEnv(eksik), /JWT_SECRET/);
  assert.equal(satirlar(webEnv({ ...SIRLAR, GELISTIRME_AUTH_PORT: '' })).AUTH_URL, `http://127.0.0.1:${GELISTIRME_PORTLARI.auth}`);
  assert.equal(satirlar(webEnv({ ...SIRLAR, GELISTIRME_AUTH_PORT: '60001' })).AUTH_URL, 'http://127.0.0.1:60001');
  assert.throws(() => webEnv({ ...SIRLAR, GELISTIRME_AUTH_PORT: 'abc' }), /GELISTIRME_AUTH_PORT/);
  assert.throws(() => webEnv({ ...SIRLAR, GELISTIRME_AUTH_PORT: '70000' }), /GELISTIRME_AUTH_PORT/);
});

test('parolalar bağlantı adresine kodlanarak girer', () => {
  const e = satirlar(webEnv({ ...SIRLAR, APP_DB_PASSWORD: 'p@ss#1/:' }));
  assert.ok(e.SHARD_DATABASE_URLS.includes('eworks_app:p%40ss%231%2F%3A@127.0.0.1'), e.SHARD_DATABASE_URLS);
});

test('web ortam dosyası compose web servisinin ortam anahtarlarının aynısını taşır (kopya kaymasın)', () => {
  const yml = readFileSync(join(KOK, 'deploy/compose/compose.yml'), 'utf8').replace(/\r\n/g, '\n');
  const web = yml.slice(yml.indexOf('\n  web:\n'));
  const blok = web.slice(web.indexOf('    environment:\n'), web.indexOf('\n    healthcheck:'));
  const composeAnahtarlari = [...blok.matchAll(/^ {6}([A-Z0-9_]+):/gm)].map((m) => m[1]).sort();
  assert.ok(composeAnahtarlari.length > 5);
  assert.deepEqual(Object.keys(satirlar(webEnv(SIRLAR))).sort(), composeAnahtarlari);
});

test('geliştirme kipi .env içinde hatırlanır: sonraki up/test/e2e port katmanını düşürmez', () => {
  const ad = (yollar) => yollar.map((d) => d.split(/[\\/]/).pop());
  assert.deepEqual(ad(composeDosyalari({})), ['compose.yml']);
  assert.deepEqual(ad(composeDosyalari({ GELISTIRME_KATMANI: '1' })), ['compose.yml', 'compose.gelistirme.yml']);
});
