#!/usr/bin/env node
// Compose yığınını yönetir (Node 20+ yeter; asıl iş container'larda koşar).
//   node tools/deploy/yigin.mjs sirlar      deploy/compose/.env yoksa güçlü rastgele sırlarla üretir (eksik anahtarları tamamlar)
//   node tools/deploy/yigin.mjs up          sırlar + imajlar + yığın (--wait: sağlık denetimleri yeşil olana kadar)
//   node tools/deploy/yigin.mjs gelistir    up + altyapı portları yalnız 127.0.0.1'de (compose.gelistirme.yml) + apps/web/.env.local;
//                                           ardından web Docker'sız: pnpm --filter @eworks/web dev → http://127.0.0.1:8765
//   node tools/deploy/yigin.mjs web-env     yalnız apps/web/.env.local'i yeniden üretir (sırlar deploy/compose/.env'den)
//   node tools/deploy/yigin.mjs debug       gelistir + işçi (Node inspector 127.0.0.1:9230) ve entegrasyon (debugpy 127.0.0.1:5678) hata
//                                           ayıklama portları; VS Code .vscode/launch.json "Docker: … bağlan" ile bağlanır
//   node tools/deploy/yigin.mjs uretim      VPS üretim kurulumu: Caddy (otomatik HTTPS, yalnız 80/443 dışarı), sahte GİB yok, üretim
//                                           ortamı (ön koşul: .env'de EWORKS_ALAN_ADI, PUBLIC_URL=https://<alan>)
//   node tools/deploy/yigin.mjs hesap-ac ofis --ofis "Ad" --eposta a@b.c --ad "Ad Soyad"   (parola: HESAP_SIFRE ortamı) ilk ofis/yönetici
//   node tools/deploy/yigin.mjs up --kip demo   kipi değiştirir (demo | gelistirme | debug | uretim); kip .env'de (YIGIN_KIPI) kalır
//   node tools/deploy/yigin.mjs down        yığını durdurur (veri birimleri korunur; --sil ile silinir)
//   node tools/deploy/yigin.mjs test        birim + entegrasyon + pgTAP testlerini yığının ağında, test koşucusu imajında çalıştırır
//   node tools/deploy/yigin.mjs satis-kullanici --eposta a@b.c --ad "Ad Soyad"   ilk satış kullanıcısı (geçici parola bir kez)
//   node tools/deploy/yigin.mjs e2e         arayüz kabul testlerini (Playwright, 4 ekran) yığına karşı çalıştırır
//   node tools/deploy/yigin.mjs helm        Helm iskeletini doğrular (helm lint + template, container'da)
// Ortam: YIGIN_PROJE (vars. eworks), YIGIN_ENV (vars. deploy/compose/.env; aynı makinede ikinci yığın denemesi için),
// YIGIN_PROFIL (vars. kipten: uretim → uretim, diğerleri → demo: sahte GİB ve demo hesabı dahil).
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMPOSE = join(KOK, 'deploy', 'compose', 'compose.yml');
const GELISTIRME = join(KOK, 'deploy', 'compose', 'compose.gelistirme.yml');
const HATA_AYIKLAMA = join(KOK, 'deploy', 'compose', 'compose.debug.yml');
const URETIM = join(KOK, 'deploy', 'compose', 'compose.uretim.yml');
const WEB_ENV = join(KOK, 'apps', 'web', '.env.local');
const ENV = process.env.YIGIN_ENV ? resolve(process.env.YIGIN_ENV) : join(KOK, 'deploy', 'compose', '.env');
const PROJE = process.env.YIGIN_PROJE ?? 'eworks';

const SIRLAR = [
  'POSTGRES_PASSWORD', 'JWT_SECRET', 'SESSION_SECRET', 'CONTROL_DB_PASSWORD', 'APP_DB_PASSWORD', 'WORKER_DB_PASSWORD',
  'INTEGRATION_DB_PASSWORD', 'REDIS_PASSWORD', 'RABBITMQ_PASSWORD', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'TAX_ID_HMAC_KEY', 'DEMO_SIFRE',
  'SALES_DB_PASSWORD', 'SALES_TOTP_KEY',
];
const VARSAYILAN = { WEB_PORT: '8080', PUBLIC_URL: 'http://localhost:8080', SATIS_PORT: '8081' };

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
    OZELLIK_DURUMU_GOSTER: 'true', // Docker'sız web yalnız gelistirme/debug kipinde (D39)
    YIGIN_KIPI: env.YIGIN_KIPI === 'debug' ? 'debug' : 'gelistirme', // logo yanındaki kip etiketi
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
  return {
    demo: [COMPOSE],
    gelistirme: [COMPOSE, GELISTIRME],
    debug: [COMPOSE, GELISTIRME, HATA_AYIKLAMA],
    uretim: [COMPOSE, URETIM],
  }[kip(env)];
}

const KIPLER = ['demo', 'gelistirme', 'debug', 'uretim'];

/** Yığın kipi (.env: YIGIN_KIPI). Eski GELISTIRME_KATMANI=1 (26.10.2026'da kısa süre kullanıldı) gelistirme sayılır. */
export function kip(env) {
  const k = env.YIGIN_KIPI || (env.GELISTIRME_KATMANI === '1' ? 'gelistirme' : 'demo');
  if (!KIPLER.includes(k)) throw new Error(`YIGIN_KIPI ${KIPLER.join(' | ')} olmalı`);
  return k;
}

/** TDD özellik durumu (kırmızı/yeşil rozetler) web'de görünsün mü (D39): yalnız gelistirme ve debug kipinde; demo ve
 * üretimde portal normal görünümündedir. Kabul testleri rozetleri doğruladığından e2e her test kipinde görünür kipte koşar;
 * üretim katmanı değeri ayrıca 'false'a sabitler. compose.yml web servisine ${OZELLIK_DURUMU_GOSTER} ile geçer. */
export function ozellikDurumuGoster(env, { e2e = false } = {}) {
  const k = kip(env);
  return k !== 'uretim' && (e2e || k === 'gelistirme' || k === 'debug') ? 'true' : 'false';
}

/** compose.yml web servisine giden kip ortamı: logo yanındaki kip etiketi ve TDD rozetleri. Yalnız kayıtlı kipten türer
 * (eski GELISTIRME_KATMANI dahil); kabukta kalmış değerler etiketle rozetleri birbirinden ayıramaz. */
export const webKipOrtami = (env, { e2e = false } = {}) => ({ YIGIN_KIPI: kip(env), OZELLIK_DURUMU_GOSTER: ozellikDurumuGoster(env, { e2e }) });

/** e2e koşusu süresince true: kabul testleri rozetleri doğrular; koşu bitince web kipin görünümüne döner. */
let e2eRozetleri = false;

/** Compose profili: üretimde HER ZAMAN uretim (kabukta kalmış YIGIN_PROFIL=demo demo hesabını ve sahte GİB'i açamasın);
 * diğer kiplerde YIGIN_PROFIL açıkça verilirse o, yoksa demo. */
export function profil(env) {
  if (kip(env) === 'uretim') return 'uretim';
  return process.env.YIGIN_PROFIL ?? 'demo';
}

/**
 * Sentetik (sahte) veri yalnız `demo` kipinde üretilir; gelistirme, debug ve uretim kiplerinde veri gerçektir —
 * geliştirici kendi kurum hesabını tanımlayıp kurumdan çeker. Bu, sahte GİB ve demo hesabından ayrı bir karardır:
 * onlar `profil`e bağlıdır ve gelistirme/debug'da açık kalır (kuruma istek gitmesin diye).
 */
export const sahteVeriKipi = (env) => kip(env) === 'demo';

/** Kip değişikliği .env'e yazılmadan önce: değer geçerli olmalı; üretimden çıkış (sahte GİB ve demo hesabını üretim
 * veritabanına açar, portları açar) yalnız açık bayrakla. */
export function kipGecisi(mevcut, yeni, bayraklar) {
  if (!KIPLER.includes(yeni)) throw new Error(`YIGIN_KIPI ${KIPLER.join(' | ')} olmalı`);
  if (mevcut === 'uretim' && yeni !== 'uretim' && !bayraklar.includes('--uretimden-cik')) {
    throw new Error(`Bu yığın üretim kipinde. ${yeni} kipine geçmek demo hesabını/sahte GİB'i ya da portları açar; bilerek yapıyorsan --uretimden-cik ekle`);
  }
}

/** test ve e2e testleri sahte GİB'e, yüksek hızla ve test verisiyle koşar: üretim yığınında asla. */
export function testKipiDenetle(env) {
  if (kip(env) === 'uretim') throw new Error('test ve e2e üretim kipinde çalıştırılmaz (gerçek GİB ve üretim veritabanı); geliştirme bilgisayarında koş');
}

/** .env + kabuk ortamı: compose kabuktaki değişkenleri .env'e tercih eder; denetim de aynı değerlere bakmalı. */
const etkinEnv = () => ({ ...envOku(), ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^[A-Z0-9_]+$/.test(k))) });

/** Üretim kurulumunun ön koşulları; eksikse hiçbir şey başlatılmaz. */
export function uretimDenetle(env) {
  const alan = (env.EWORKS_ALAN_ADI ?? '').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost$/i.test(alan)) throw new Error('EWORKS_ALAN_ADI .env içinde alan adı olmalı (ör. portal.ornek.com.tr)');
  if (env.PUBLIC_URL !== `https://${alan}` && !env.PUBLIC_URL?.startsWith(`https://${alan}:`)) {
    throw new Error(`PUBLIC_URL https://${alan} olmalı (tarayıcıdaki adres; giriş ve çerezler buna bağlı)`);
  }
  if (env.GIB_SAHTE_SUNUCU) throw new Error('GIB_SAHTE_SUNUCU üretimde boş olmalı (sahte GİB yalnız demo/test)');
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
  // Demo hesabı (üretim dışı): giriş yapılabilsin diye gelistirme ve debug kiplerinde de açılır.
  if (profil(envOku()) === 'demo') docker(compose('run', '--rm', 'hesap-ac'));
  // Sentetik veri YALNIZ demo kipinde: diğer kiplerde ekranlar kurumdan çekilen gerçek veriyle dolar.
  if (sahteVeriKipi(envOku())) docker(compose('run', '--rm', 'demo-veri'));
  docker(compose('up', '-d', '--remove-orphans', '--wait', '--wait-timeout', '600', ...ek));
}

const compose = (...args) => {
  const env = envOku();
  // Kipten türetilir (.env'e yazılmaz), her çağrıda yeniden yazılır; docker süreci bu ortamı devralır
  Object.assign(process.env, webKipOrtami(env, { e2e: e2eRozetleri }));
  return ['compose', '-p', PROJE, '--env-file', ENV, ...composeDosyalari(env).flatMap((d) => ['-f', d]), '--profile', profil(env), ...args];
};

function kipKur(yeni) {
  envAyarla('GELISTIRME_KATMANI', null);
  envAyarla('YIGIN_KIPI', yeni);
}

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
  // Denetim hataları (kip, üretim ön koşulları, eksik sır) junior'a yığın izi değil tek satır gösterilir
  process.on('uncaughtException', (e) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
  if (komut === 'sirlar') {
    const n = sirlariTamamla();
    console.log(n ? `✔ ${n} sır üretildi: ${ENV}` : '✔ Sırlar zaten tam');
  } else if (komut === 'up') {
    sirlariTamamla();
    const i = geri.indexOf('--kip');
    const yeni = i >= 0 ? geri[i + 1] : geri.includes('--gelistirme-kapat') ? 'demo' : kip(envOku());
    kipGecisi(kip(envOku()), yeni, geri);
    if (yeni === 'uretim') uretimDenetle(etkinEnv());
    kipKur(yeni); // denetimler geçtikten sonra yazılır
    if (yeni === 'uretim') docker(compose('--profile', 'demo', 'rm', '-sf', 'fake-gib')); // demo'dan geçişte kalan sahte GİB
    yiginiKaldir(geri.filter((a, j) => !a.startsWith('--') && (i < 0 || j !== i + 1)));
    const env = envOku();
    console.log(`\n✔ Yığın ayakta (kip: ${kip(env)}): ${env.PUBLIC_URL ?? 'http://localhost:8080'}`);
    console.log(`  Satış portalı: http://localhost:${env.SATIS_PORT ?? '8081'} (ilk satışçı: node tools/deploy/yigin.mjs satis-kullanici --eposta … --ad "…")`);
    if (kip(env) !== 'demo' && kip(env) !== 'uretim') console.log("  Altyapı portları 127.0.0.1'de; normale dönmek için: up --kip demo");
  } else if (komut === 'gelistir' || komut === 'debug') {
    sirlariTamamla();
    const yeni = komut === 'debug' ? 'debug' : 'gelistirme';
    kipGecisi(kip(envOku()), yeni, geri);
    kipKur(yeni);
    yiginiKaldir(geri);
    const yol = webEnvYaz();
    console.log([
      '',
      `✔ Yığın ayakta (Docker içindeki web: ${envOku().PUBLIC_URL ?? 'http://localhost:8080'}); altyapı portları yalnız 127.0.0.1'de.`,
      `✔ Web ortamı yazıldı: ${yol} (sır içerir, commit edilmez)`,
      "  Docker'sız web (değişiklikte anında yenilenir):  pnpm --filter @eworks/web dev   →  http://127.0.0.1:8765",
      ...(komut === 'debug'
        ? ['  Hata ayıklama: VS Code → Run and Debug → "Docker: işçiye bağlan (9230)" / "Docker: entegrasyona bağlan (Python 5678)"']
        : []),
      '  Normale dönmek için: node tools/deploy/yigin.mjs up --kip demo',
    ].join('\n'));
  } else if (komut === 'uretim') {
    sirlariTamamla();
    uretimDenetle(etkinEnv());
    kipKur('uretim');
    docker(compose('--profile', 'demo', 'rm', '-sf', 'fake-gib')); // demo'dan geçişte kalan sahte GİB
    yiginiKaldir(geri);
    console.log([
      '',
      `✔ Üretim yığını ayakta: ${envOku().PUBLIC_URL}`,
      '  İlk ofis yöneticisi: HESAP_SIFRE=… node tools/deploy/yigin.mjs hesap-ac ofis --ofis "Ofis adı" --eposta … --ad "Ad Soyad"',
    ].join('\n'));
  } else if (komut === 'hesap-ac') {
    const kullanim = [
      'Kullanım (parola HESAP_SIFRE ortamından):',
      '  node tools/deploy/yigin.mjs hesap-ac ofis --ofis "Ofis adı" --eposta a@b.c --ad "Ad Soyad"',
      '  node tools/deploy/yigin.mjs hesap-ac uye --ofis-id <uuid> --eposta a@b.c --ad "Ad Soyad" --rol personel|musavir|ofis_admin',
    ].join('\n');
    const gerekli = { ofis: ['--ofis', '--eposta', '--ad'], uye: ['--ofis-id', '--eposta', '--ad', '--rol'] }[geri[0]];
    if (!gerekli || gerekli.some((b) => !geri.includes(b))) {
      console.error(kullanim);
      process.exit(2);
    }
    if (!process.env.HESAP_SIFRE) {
      console.error('✖ HESAP_SIFRE ortam değişkeni gerekli (parola komut satırına ve geçmişe yazılmasın diye ortamdan alınır)');
      process.exit(2);
    }
    // Parola değeri komut satırına yazılmaz: -e HESAP_SIFRE yalnız adı geçirir, değer bu sürecin ortamından alınır
    docker(compose('run', '--rm', '-e', 'HESAP_SIFRE', 'hesap-ac', 'node', 'apps/worker/src/hesap-ac.ts', ...geri));
  } else if (komut === 'satis-kullanici') {
    if (!geri.includes('--eposta') || !geri.includes('--ad')) {
      console.error('Kullanım: node tools/deploy/yigin.mjs satis-kullanici --eposta ad.soyad@firma.com --ad "Ad Soyad"');
      process.exit(2);
    }
    // Geçici parola bir kez ekrana yazılır; satışçı ilk girişte değiştirir ve iki adımlı doğrulamayı kurar
    docker(compose('run', '--rm', 'satis-kullanici', 'node', 'apps/worker/src/satis-kullanici.ts', ...geri));
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
    testKipiDenetle(envOku());
    // Testler yalnız sahte GİB'e gider: kurum hız bütçesi test süresini uzatmasın (üretim/demo varsayılanı 60/dk)
    process.env.GIB_ISTEK_DK ??= '600';
    // Kabul testleri TDD rozetlerini doğrular (D39): demo kipinde de e2e süresince rozetler açılır
    e2eRozetleri = komut === 'e2e';
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
      TEST_SALES_DB_PASSWORD: env.SALES_DB_PASSWORD,
      TEST_REDIS_URL: `redis://:${env.REDIS_PASSWORD}@redis:6379/15`,
      TEST_RABBITMQ_URL: `amqp://eworks:${env.RABBITMQ_PASSWORD}@rabbitmq:5672`,
      TEST_S3_ENDPOINT: 'http://s3:8333',
      TEST_S3_ACCESS_KEY: env.S3_ACCESS_KEY,
      TEST_S3_SECRET_KEY: env.S3_SECRET_KEY,
      TEST_AUTH_URL: 'http://auth:9999',
      TEST_JWT_SECRET: env.JWT_SECRET,
      TEST_TAX_ID_HMAC_KEY: env.TAX_ID_HMAC_KEY,
      TEST_WEB_URL: 'http://web:3000',
      TEST_SATIS_URL: 'http://sales:3000',
      // Satış portalının Redis'i (kabul testi resimli güvenlik kodunun yanıtını buradan okur, D41)
      TEST_SATIS_REDIS_URL: `redis://:${env.REDIS_PASSWORD}@redis:6379/2`,
      TEST_FAKE_GIB_URL: 'http://fake-gib:8090',
    };
    const envArgs = Object.entries(ortam).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const ag = execFileSync('docker', compose('ps', '-q', 'db-control'), { encoding: 'utf8', cwd: KOK }).trim();
    const network = execFileSync('docker', ['inspect', '-f', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}', ag], { encoding: 'utf8' }).trim().split(' ')[0];
    if (e2eRozetleri && ozellikDurumuGoster(env) === 'false') {
      console.log('  Not: e2e süresince TDD rozetleri açık; başarılı koşu sonunda web normal görünüme döner (aksi hâlde: node tools/deploy/yigin.mjs up)');
    }
    docker(['run', '--rm', '--network', network, ...envArgs, '-v', `${sonuc}:/app/test-results`, `eworks/${hedef}:local`, ...geri]);
    // Python ACL: birim + robot akışı (süreç içi sahte GİB, gerçek tarayıcı) + import kuralları
    if (komut === 'test') {
      // debug kipinde entegrasyon imajı :debug etiketiyle derlenir
      docker(['run', '--rm', '--ipc=host', '-v', `${sonuc}:/out`, `eworks/integration:${kip(env) === 'debug' ? 'debug' : 'local'}`, 'sh', '-c',
        'python3 -m pytest -q -p no:cacheprovider --junitxml=/out/pytest.xml && lint-imports --no-cache']);
    }
    if (komut === 'e2e' && ozellikDurumuGoster(env) === 'false') {
      // Demo kipinde web normal görünümüne döner (testler kırmızıysa docker() önce çıkar: o zaman `up` döndürür)
      e2eRozetleri = false;
      docker(compose('up', '-d', '--no-deps', '--wait', 'web'));
    }
  } else {
    console.error('Kullanım: node tools/deploy/yigin.mjs sirlar|up [--kip demo|gelistirme|debug|uretim]|gelistir|debug|uretim|hesap-ac|satis-kullanici|web-env|down [--sil]|test|e2e|helm');
    process.exit(2);
  }
}
