#!/usr/bin/env node
// Compose yığınını yönetir (Node 20+ yeter; asıl iş container'larda koşar).
//   node tools/deploy/yigin.mjs sirlar      deploy/compose/.env yoksa güçlü rastgele sırlarla üretir (eksik anahtarları tamamlar)
//   node tools/deploy/yigin.mjs up          sırlar + imajlar + yığın (--wait: sağlık denetimleri yeşil olana kadar)
//   node tools/deploy/yigin.mjs down        yığını durdurur (veri birimleri korunur; --sil ile silinir)
//   node tools/deploy/yigin.mjs test        birim + entegrasyon + pgTAP testlerini yığının ağında, test koşucusu imajında çalıştırır
//   node tools/deploy/yigin.mjs e2e         arayüz kabul testlerini (Playwright, 4 ekran) yığına karşı çalıştırır
//   node tools/deploy/yigin.mjs helm        Helm iskeletini doğrular (helm lint + template, container'da)
// Ortam: YIGIN_PROJE (vars. eworks), YIGIN_PROFIL (vars. demo: sahte GİB dahil).
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = join(KOK, 'deploy', 'compose', 'compose.yml');
const ENV = join(KOK, 'deploy', 'compose', '.env');
const PROJE = process.env.YIGIN_PROJE ?? 'eworks';
const PROFIL = process.env.YIGIN_PROFIL ?? 'demo';

const SIRLAR = [
  'POSTGRES_PASSWORD', 'JWT_SECRET', 'SESSION_SECRET', 'CONTROL_DB_PASSWORD', 'APP_DB_PASSWORD', 'WORKER_DB_PASSWORD',
  'INTEGRATION_DB_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'TAX_ID_HMAC_KEY', 'DEMO_SIFRE',
];
const VARSAYILAN = { WEB_PORT: '8080', PUBLIC_URL: 'http://localhost:8080' };

export function envOku(yol = ENV) {
  if (!existsSync(yol)) return {};
  return Object.fromEntries(
    readFileSync(yol, 'utf8').split(/\r?\n/).filter((s) => /^[A-Z0-9_]+=/.test(s)).map((s) => [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)]),
  );
}

/** Eksik sırları üretir; var olanlara dokunmaz. URL ve kabukta sorun çıkarmasın diye yalnız [A-Za-z0-9]. */
export function sirlariTamamla(yol = ENV) {
  const env = { ...VARSAYILAN, ...envOku(yol) };
  let eklenen = 0;
  for (const k of SIRLAR) {
    if (!env[k]) {
      env[k] = randomBytes(36).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
      eklenen++;
    }
  }
  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, '# Üretildi: node tools/deploy/yigin.mjs sirlar — commit etmeyin\n' + Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  return eklenen;
}

const ALTYAPI = ['db-control', 'auth', 'db-shard-01', 'db-shard-02', 'redis', 'rabbitmq', 's3'];

/** Altyapı → migration → uygulama servisleri; tek seferlik görevler `--wait`'i bozmasın diye ayrı çalışır. */
function yiginiKaldir(ek = []) {
  // Görev profilindeki servisler (migrate, hesap-ac) de derlensin; `up` ise onları başlatmasın
  docker(['compose', '-p', PROJE, '--env-file', ENV, '-f', COMPOSE, '--profile', PROFIL, '--profile', 'gorev', 'build']);
  docker(compose('up', '-d', '--wait', '--wait-timeout', '600', ...ALTYAPI));
  docker(compose('run', '--rm', 'migrate'));
  if (PROFIL === 'demo') docker(compose('run', '--rm', 'hesap-ac'));
  docker(compose('up', '-d', '--wait', '--wait-timeout', '600', ...ek));
}

const compose = (...args) => ['compose', '-p', PROJE, '--env-file', ENV, '-f', COMPOSE, '--profile', PROFIL, ...args];
const docker = (args, opts = {}) => {
  const r = spawnSync('docker', args, { stdio: 'inherit', cwd: KOK, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [komut = 'up', ...geri] = process.argv.slice(2);
  if (komut === 'sirlar') {
    const n = sirlariTamamla();
    console.log(n ? `✔ ${n} sır üretildi: ${ENV}` : '✔ Sırlar zaten tam');
  } else if (komut === 'up') {
    sirlariTamamla();
    yiginiKaldir(geri);
    const env = envOku();
    console.log(`\n✔ Yığın ayakta: ${env.PUBLIC_URL ?? 'http://localhost:8080'}`);
  } else if (komut === 'helm') {
    const k8s = join(KOK, 'deploy', 'k8s');
    docker(['run', '--rm', '-v', `${k8s}:/k`, 'alpine/helm:3.19.0', 'lint', '/k/eworks']);
    docker(['run', '--rm', '-v', `${k8s}:/k`, 'alpine/helm:3.19.0', 'template', 'eworks', '/k/eworks'], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✔ Helm: lint + template');
  } else if (komut === 'down') {
    docker(compose('down', ...(geri.includes('--sil') ? ['-v'] : [])));
  } else if (komut === 'test' || komut === 'e2e') {
    sirlariTamamla();
    yiginiKaldir();
    const env = envOku();
    const hedef = komut === 'test' ? 'ci' : 'e2e';
    docker(['build', '-q', '-f', 'deploy/docker/node.Dockerfile', '--target', hedef, '-t', `eworks/${hedef}:local`, '.']);
    const sonuc = join(KOK, 'test-results');
    mkdirSync(sonuc, { recursive: true });
    const ortam = {
      TEST_CONTROL_URL: `postgres://postgres:${env.POSTGRES_PASSWORD}@db-control:5432/postgres`,
      TEST_SHARD_URLS: `shard-01=postgres://postgres:${env.POSTGRES_PASSWORD}@db-shard-01:5432/postgres,shard-02=postgres://postgres:${env.POSTGRES_PASSWORD}@db-shard-02:5432/postgres`,
      TEST_APP_DB_PASSWORD: env.APP_DB_PASSWORD,
      TEST_WORKER_DB_PASSWORD: env.WORKER_DB_PASSWORD,
      TEST_INTEGRATION_DB_PASSWORD: env.INTEGRATION_DB_PASSWORD,
      TEST_CONTROL_DB_PASSWORD: env.CONTROL_DB_PASSWORD,
      TEST_REDIS_URL: `redis://:${env.REDIS_PASSWORD}@redis:6379/15`,
      TEST_RABBITMQ_URL: `amqp://eworks:${env.RABBITMQ_PASSWORD}@rabbitmq:5672`,
      TEST_S3_ENDPOINT: 'http://s3:8333',
      TEST_S3_ACCESS_KEY: env.S3_ACCESS_KEY,
      TEST_S3_SECRET_KEY: env.S3_SECRET_KEY,
      TEST_AUTH_URL: 'http://auth:9999',
      TEST_JWT_SECRET: env.JWT_SECRET,
      TEST_WEB_URL: 'http://web:3000',
      TEST_FAKE_GIB_URL: 'http://fake-gib:8090',
    };
    const envArgs = Object.entries(ortam).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const ag = execFileSync('docker', compose('ps', '-q', 'db-control'), { encoding: 'utf8', cwd: KOK }).trim();
    const network = execFileSync('docker', ['inspect', '-f', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}', ag], { encoding: 'utf8' }).trim().split(' ')[0];
    docker(['run', '--rm', '--network', network, ...envArgs, '-v', `${sonuc}:/app/test-results`, `eworks/${hedef}:local`, ...geri]);
  } else {
    console.error('Kullanım: node tools/deploy/yigin.mjs sirlar|up|down [--sil]|test|e2e|helm');
    process.exit(2);
  }
}
