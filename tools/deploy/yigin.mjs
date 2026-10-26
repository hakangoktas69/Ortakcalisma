#!/usr/bin/env node
// Compose yığınını yönetir (Node 20+ yeter; asıl iş container'larda koşar).
//   node tools/deploy/yigin.mjs sirlar      deploy/compose/.env yoksa güçlü rastgele sırlarla üretir (eksik anahtarları tamamlar)
//   node tools/deploy/yigin.mjs up          sırlar + imajlar + yığın (--wait: sağlık denetimleri yeşil olana kadar)
//   node tools/deploy/yigin.mjs gelistir    up + altyapı portları yalnız 127.0.0.1'de (compose.gelistirme.yml) + apps/web/.env.local;
//                                           ardından web Docker'sız: pnpm --filter @eworks/web dev → http://127.0.0.1:8765
//   node tools/deploy/yigin.mjs web-env     yalnız apps/web/.env.local'i yeniden üretir (sırlar deploy/compose/.env'den)
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
const GELISTIRME = join(KOK, 'deploy', 'compose', 'compose.gelistirme.yml');
const WEB_ENV = join(KOK, 'apps', 'web', '.env.local');
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

// Geliştirme katmanının varsayılan yerel portları (compose.gelistirme.yml ile aynı; .env'de GELISTIRME_*_PORT ile değişir)
export const GELISTIRME_PORTLARI = { dbControl: 54320, dbShard01: 54321, dbShard02: 54322, auth: 59999, redis: 56379, s3: 58333 };
const PORT_ADLARI = { dbControl: 'GELISTIRME_DB_CONTROL_PORT', dbShard01: 'GELISTIRME_DB_SHARD_01_PORT', dbShard02: 'GELISTIRME_DB_SHARD_02_PORT',
  auth: 'GELISTIRME_AUTH_PORT', redis: 'GELISTIRME_REDIS_PORT', s3: 'GELISTIRME_S3_PORT' };

const WEB_SIRLARI = ['CONTROL_DB_PASSWORD', 'APP_DB_PASSWORD', 'JWT_SECRET', 'SESSION_SECRET', 'TAX_ID_HMAC_KEY', 'REDIS_PASSWORD', 'S3_ACCESS_KEY',
  'S3_SECRET_KEY'];

/** .env'deki port: boşsa varsayılan (compose'daki ${VAR:-varsayılan} gibi), geçersizse hata. */
function portOku(env, ad, varsayilan) {
  const ham = (env[ad] ?? '').trim();
  if (ham === '') return varsayilan;
  const n = Number(ham);
  if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error(`${ad} 1–65535 arasında bir port olmalı`);
  return n;
}

/** apps/web/.env.local içeriği: web'in Docker dışından yığına bağlanması. Süper kullanıcı parolası verilmez (web uygulama rolüyle bağlanır). */
export function webEnv(env, { adres = () => '127.0.0.1', portlar } = {}) {
  const eksik = WEB_SIRLARI.filter((k) => !env[k]);
  if (eksik.length > 0) throw new Error(`deploy/compose/.env'de eksik: ${eksik.join(', ')} — node tools/deploy/yigin.mjs sirlar`);
  const p = portlar ?? Object.fromEntries(Object.entries(GELISTIRME_PORTLARI).map(([k, v]) => [k, portOku(env, PORT_ADLARI[k], v)]));
  const db = (servis, kullanici, parola, port) => `postgres://${kullanici}:${encodeURIComponent(parola)}@${adres(servis)}:${port}/postgres`;
  const degerler = {
    EWORKS_ORTAM: 'gelistirme',
    COOKIE_SECURE: 'false',
    CONTROL_DATABASE_URL: db('db-control', 'eworks_control', env.CONTROL_DB_PASSWORD, p.dbControl),
    SHARD_DATABASE_URLS: `shard-01=${db('db-shard-01', 'eworks_app', env.APP_DB_PASSWORD, p.dbShard01)},shard-02=${db('db-shard-02', 'eworks_app', env.APP_DB_PASSWORD, p.dbShard02)}`,
    AUTH_URL: `http://${adres('auth')}:${p.auth}`,
    JWT_SECRET: env.JWT_SECRET,
    SESSION_SECRET: env.SESSION_SECRET,
    TAX_ID_HMAC_KEY: env.TAX_ID_HMAC_KEY,
    REDIS_URL: `redis://:${encodeURIComponent(env.REDIS_PASSWORD)}@${adres('redis')}:${p.redis}/0`,
    S3_ENDPOINT: `http://${adres('s3')}:${p.s3}`,
    S3_ACCESS_KEY: env.S3_ACCESS_KEY,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
  };
  return '# Üretildi: node tools/deploy/yigin.mjs web-env — sır içerir, commit etmeyin (.gitignore: .env.*)\n' +
    Object.entries(degerler).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

/** Compose dosyaları. Geliştirme kipi (.env: GELISTIRME_KATMANI=1, `gelistir` yazar) sonraki up/test/e2e/down'da da korunur;
 * yoksa bir `up` port katmanını düşürür ve Docker'sız web bağlantısını kaybeder. */
export function composeDosyalari(env = envOku()) {
  return env.GELISTIRME_KATMANI === '1' ? [COMPOSE, GELISTIRME] : [COMPOSE];
}

function envAyarla(anahtar, deger) {
  const env = { ...envOku(), [anahtar]: deger };
  if (deger === null) delete env[anahtar];
  writeFileSync(ENV, '# Üretildi: node tools/deploy/yigin.mjs sirlar — commit etmeyin\n' + Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
}

const konteyner = (servis) => execFileSync('docker', compose('ps', '-q', servis), { encoding: 'utf8', cwd: KOK }).trim();

/** Altyapı → migration → uygulama servisleri; tek seferlik görevler `--wait`'i bozmasın diye ayrı çalışır. */
function yiginiKaldir(ek = []) {
  // Görev profilindeki servisler (migrate, hesap-ac) de derlensin; `up` ise onları başlatmasın
  docker(compose('--profile', 'gorev', 'build'));
  const onceki = konteyner('db-control');
  docker(compose('up', '-d', '--wait', '--wait-timeout', '600', ...ALTYAPI));
  if (onceki && konteyner('db-control') !== onceki) {
    // Kontrol veritabanı yeniden oluşturuldu: GoTrue eski bağlantıda kalıp 500 verir, yeniden başlatılır
    docker(compose('restart', 'auth'));
    docker(compose('up', '-d', '--wait', '--wait-timeout', '120', 'auth'));
  }
  docker(compose('run', '--rm', 'migrate'));
  if (PROFIL === 'demo') docker(compose('run', '--rm', 'hesap-ac'));
  docker(compose('up', '-d', '--remove-orphans', '--wait', '--wait-timeout', '600', ...ek));
}

const compose = (...args) => ['compose', '-p', PROJE, '--env-file', ENV, ...composeDosyalari().flatMap((d) => ['-f', d]), '--profile', PROFIL, ...args];

function webEnvYaz() {
  writeFileSync(WEB_ENV, webEnv(envOku()));
  return WEB_ENV;
}
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
    if (geri.includes('--gelistirme-kapat')) envAyarla('GELISTIRME_KATMANI', null); // altyapı portlarını yeniden kapat
    yiginiKaldir(geri.filter((a) => !a.startsWith('--')));
    const env = envOku();
    console.log(`\n✔ Yığın ayakta: ${env.PUBLIC_URL ?? 'http://localhost:8080'}`);
    if (env.GELISTIRME_KATMANI === '1') console.log("  Geliştirme kipi açık: altyapı portları 127.0.0.1'de (kapatmak için: up --gelistirme-kapat)");
  } else if (komut === 'gelistir') {
    sirlariTamamla();
    envAyarla('GELISTIRME_KATMANI', '1');
    yiginiKaldir(geri);
    const yol = webEnvYaz();
    console.log([
      '',
      `✔ Yığın ayakta (Docker içindeki web: ${envOku().PUBLIC_URL ?? 'http://localhost:8080'}); altyapı portları yalnız 127.0.0.1'de.`,
      `✔ Web ortamı yazıldı: ${yol} (sır içerir, commit edilmez)`,
      "  Docker'sız web (değişiklikte anında yenilenir):  pnpm --filter @eworks/web dev   →  http://127.0.0.1:8765",
    ].join('\n'));
  } else if (komut === 'web-env') {
    sirlariTamamla();
    console.log(`✔ Web ortamı yazıldı: ${webEnvYaz()} (sır içerir, commit edilmez)`);
  } else if (komut === 'helm') {
    const k8s = join(KOK, 'deploy', 'k8s');
    docker(['run', '--rm', '-v', `${k8s}:/k`, 'alpine/helm:3.19.0', 'lint', '/k/eworks']);
    docker(['run', '--rm', '-v', `${k8s}:/k`, 'alpine/helm:3.19.0', 'template', 'eworks', '/k/eworks'], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log('✔ Helm: lint + template');
  } else if (komut === 'down') {
    docker(compose('down', ...(geri.includes('--sil') ? ['-v'] : [])));
  } else if (komut === 'test' || komut === 'e2e') {
    sirlariTamamla();
    // Testler yalnız sahte GİB'e gider: kurum hız bütçesi test süresini uzatmasın (üretim/demo varsayılanı 60/dk)
    process.env.GIB_ISTEK_DK ??= '600';
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
      TEST_TAX_ID_HMAC_KEY: env.TAX_ID_HMAC_KEY,
      TEST_WEB_URL: 'http://web:3000',
      TEST_FAKE_GIB_URL: 'http://fake-gib:8090',
    };
    const envArgs = Object.entries(ortam).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const ag = execFileSync('docker', compose('ps', '-q', 'db-control'), { encoding: 'utf8', cwd: KOK }).trim();
    const network = execFileSync('docker', ['inspect', '-f', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}', ag], { encoding: 'utf8' }).trim().split(' ')[0];
    docker(['run', '--rm', '--network', network, ...envArgs, '-v', `${sonuc}:/app/test-results`, `eworks/${hedef}:local`, ...geri]);
    // Python ACL: birim + robot akışı (süreç içi sahte GİB, gerçek tarayıcı) + import kuralları
    if (komut === 'test') {
      docker(['run', '--rm', '--ipc=host', '-v', `${sonuc}:/out`, 'eworks/integration:local', 'sh', '-c',
        'python3 -m pytest -q -p no:cacheprovider --junitxml=/out/pytest.xml && lint-imports --no-cache']);
    }
  } else {
    console.error('Kullanım: node tools/deploy/yigin.mjs sirlar|up|gelistir|web-env|down [--sil]|test|e2e|helm');
    process.exit(2);
  }
}
