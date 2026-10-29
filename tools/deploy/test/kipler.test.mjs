// Yığın kipleri (demo, gelistirme, debug, uretim) ve VS Code yapılandırması: her kipin compose katmanları, güvenlik sınırları
// (hata ayıklama portları yalnız 127.0.0.1, üretimde yalnız ters vekil dışarı açık) ve launch.json ↔ compose port uyumu.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { composeDosyalari, kipGecisi, kurumOrtami, ozellikDurumuGoster, profil, sahteVeriKipi, VAULT_ANAHTARLI_DB, vaultAnahtarlari, webKipOrtami, testKipiDenetle, uretimDenetle } from '../yigin.mjs';

const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const oku = (yol) => readFileSync(join(KOK, yol), 'utf8').replace(/\r\n/g, '\n');
const ad = (yollar) => yollar.map((d) => d.split(/[\\/]/).pop());
const servis = (yml, adi) => {
  const i = yml.indexOf(`\n  ${adi}:\n`);
  assert.ok(i >= 0, `${adi} servisi yok`);
  const j = yml.slice(i + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return j < 0 ? yml.slice(i) : yml.slice(i, i + 1 + j);
};
const yayinlanan = (blok) => [...blok.matchAll(/^\s*-\s*'([^']+)'\s*$/gm)].map((m) => m[1]).filter((p) => /:\d+(\/udp)?$/.test(p));

test('kipler compose katmanlarını belirler; eski GELISTIRME_KATMANI gelistirme sayılır; bilinmeyen kip reddedilir', () => {
  assert.deepEqual(ad(composeDosyalari({})), ['compose.yml']);
  assert.deepEqual(ad(composeDosyalari({ YIGIN_KIPI: 'demo' })), ['compose.yml']);
  assert.deepEqual(ad(composeDosyalari({ YIGIN_KIPI: 'gelistirme' })), ['compose.yml', 'compose.gelistirme.yml']);
  assert.deepEqual(ad(composeDosyalari({ GELISTIRME_KATMANI: '1' })), ['compose.yml', 'compose.gelistirme.yml']);
  assert.deepEqual(ad(composeDosyalari({ YIGIN_KIPI: 'debug' })), ['compose.yml', 'compose.gelistirme.yml', 'compose.debug.yml']);
  assert.deepEqual(ad(composeDosyalari({ YIGIN_KIPI: 'uretim' })), ['compose.yml', 'compose.uretim.yml']);
  assert.throws(() => composeDosyalari({ YIGIN_KIPI: 'canli' }), /YIGIN_KIPI/);
  assert.equal(profil({ YIGIN_KIPI: 'uretim' }), 'uretim');
  assert.equal(profil({ YIGIN_KIPI: 'debug' }), 'uretim'); // sahte GİB yalnız demo kipinde (Hakan 29.10 14:56)
});

test('hata ayıklama katmanı: işçi ve entegrasyon yalnız 127.0.0.1 üzerinden dinler; entegrasyon debug imaj hedefinden', () => {
  const yml = oku('deploy/compose/compose.debug.yml');
  const isci = servis(yml, 'worker');
  assert.match(isci, /--inspect=0\.0\.0\.0:9229/);
  assert.deepEqual(yayinlanan(isci), ['127.0.0.1:${HATA_AYIKLAMA_ISCI_PORT:-9230}:9229']);
  const ent = servis(yml, 'integration');
  assert.match(ent, /target: debug/);
  assert.match(ent, /debugpy/);
  assert.deepEqual(yayinlanan(ent), ['127.0.0.1:${HATA_AYIKLAMA_PYTHON_PORT:-5678}:5678']);
  assert.match(oku('deploy/compose/compose.yml'), /dockerfile: deploy\/docker\/integration\.Dockerfile\n\s+target: uretim/);
});

test('üretim katmanı: dışarıya yalnız ters vekil açılır; sahte GİB yok; güvenli çerez ve üretim ortamı zorunlu', () => {
  const yml = oku('deploy/compose/compose.uretim.yml');
  assert.deepEqual(yayinlanan(servis(yml, 'caddy')), ['${URETIM_HTTP_PORT:-80}:80', '${URETIM_HTTPS_PORT:-443}:443', '${URETIM_HTTPS_PORT:-443}:443/udp']);
  assert.match(servis(yml, 'web'), /ports: !reset \[\]/);
  assert.match(servis(yml, 'web'), /EWORKS_ORTAM: uretim/);
  assert.match(servis(yml, 'web'), /COOKIE_SECURE: 'true'/);
  assert.match(servis(yml, 'web'), /OZELLIK_DURUMU_GOSTER: 'false'/);
  assert.match(servis(yml, 'web'), /YIGIN_KIPI: uretim/);
  assert.match(servis(yml, 'integration'), /EWORKS_ORTAM: uretim/);
  assert.match(servis(yml, 'integration'), /GIB_SAHTE_SUNUCU: ''/);
  for (const [s, b] of ['web', 'integration'].map((s) => [s, servis(yml, s)])) assert.deepEqual(yayinlanan(b), [], s);
  assert.match(oku('deploy/compose/caddy/Caddyfile'), /reverse_proxy web:3000/);
});

test('üretim ön koşulları: alan adı, https adres ve sahte GİB denetlenir', () => {
  const tamam = { EWORKS_ALAN_ADI: 'portal.ornek.com.tr', PUBLIC_URL: 'https://portal.ornek.com.tr' };
  assert.doesNotThrow(() => uretimDenetle(tamam));
  assert.throws(() => uretimDenetle({ ...tamam, EWORKS_ALAN_ADI: '' }), /EWORKS_ALAN_ADI/);
  assert.throws(() => uretimDenetle({ ...tamam, PUBLIC_URL: 'http://portal.ornek.com.tr' }), /PUBLIC_URL/);
  assert.throws(() => uretimDenetle({ ...tamam, PUBLIC_URL: 'https://baska.ornek.com.tr' }), /PUBLIC_URL/);
  assert.throws(() => uretimDenetle({ ...tamam, GIB_SAHTE_SUNUCU: 'http://fake-gib:8090' }), /GIB_SAHTE_SUNUCU/);
});

test('VS Code: launch.json ve tasks.json geçerli; Docker bağlanma portları compose hata ayıklama katmanıyla aynı', () => {
  const launch = JSON.parse(oku('.vscode/launch.json'));
  const adlar = launch.configurations.map((c) => c.name);
  for (const a of ['Web: sunucu + tarayıcı (8765)', 'Web: yalnız sunucu (8765)', 'Web: tarayıcı (8765)', 'Birim testi: açık dosya (Vitest)',
    'Betik: açık dosya (Node 24)', 'Docker: işçiye bağlan (9230)', 'Docker: entegrasyona bağlan (Python 5678)']) assert.ok(adlar.includes(a), a);
  const bul = (a) => launch.configurations.find((c) => c.name === a);
  assert.equal(bul('Docker: işçiye bağlan (9230)').port, 9230);
  assert.equal(bul('Docker: işçiye bağlan (9230)').remoteRoot, '/app');
  assert.equal(bul('Docker: entegrasyona bağlan (Python 5678)').connect.port, 5678);
  assert.deepEqual(bul('Docker: entegrasyona bağlan (Python 5678)').pathMappings, [{ localRoot: '${workspaceFolder}/services/integration', remoteRoot: '/app' }]);
  assert.match(bul('Web: sunucu + tarayıcı (8765)').command, /pnpm --filter @eworks\/web dev/);
  const gorevler = JSON.parse(oku('.vscode/tasks.json')).tasks.map((t) => t.label);
  for (const g of ['Yığın: up', 'Yığın: gelistir', 'Yığın: debug', 'Yığın: test', 'Yığın: e2e', 'Yığın: down', 'pnpm verify']) assert.ok(gorevler.includes(g), g);
  const eklenti = JSON.parse(oku('.vscode/extensions.json')).recommendations;
  for (const e of ['ms-python.debugpy', 'ms-azuretools.vscode-docker']) assert.ok(eklenti.includes(e), e);
});

test('başlangıç rehberindeki launch.json içeriği depodaki dosyayla aynı (belge kaymasın)', () => {
  const rehber = oku('docs/gelistirici-rehberi/baslangic.md');
  const blok = /```json\n([\s\S]*?)\n```/.exec(rehber);
  assert.ok(blok, 'rehberde json bloğu yok');
  assert.deepEqual(JSON.parse(blok[1]), JSON.parse(oku('.vscode/launch.json')));
});

test("üretimde profil her zaman uretim: kabuktaki YIGIN_PROFIL demo hesabını ve sahte GİB'i açamaz", () => {
  const eski = process.env.YIGIN_PROFIL;
  process.env.YIGIN_PROFIL = 'demo';
  try {
    assert.equal(profil({ YIGIN_KIPI: 'uretim' }), 'uretim');
    assert.equal(profil({ YIGIN_KIPI: 'gelistirme' }), 'demo');
  } finally {
    if (eski === undefined) delete process.env.YIGIN_PROFIL;
    else process.env.YIGIN_PROFIL = eski;
  }
});

test('kip geçişi: geçersiz değer yazılmaz; üretimden çıkmak açık bayrak ister', () => {
  assert.throws(() => kipGecisi('demo', undefined, []), /YIGIN_KIPI/);
  assert.throws(() => kipGecisi('demo', 'canli', []), /YIGIN_KIPI/);
  assert.doesNotThrow(() => kipGecisi('demo', 'debug', []));
  assert.doesNotThrow(() => kipGecisi('uretim', 'uretim', []));
  for (const yeni of ['demo', 'gelistirme', 'debug']) assert.throws(() => kipGecisi('uretim', yeni, []), /--uretimden-cik/);
  assert.doesNotThrow(() => kipGecisi('uretim', 'demo', ['--uretimden-cik']));
});

test('test ve e2e üretim kipinde çalışmaz (gerçek GİB ve üretim veritabanı)', () => {
  assert.throws(() => testKipiDenetle({ YIGIN_KIPI: 'uretim' }), /üretim/);
  for (const k of ['demo', 'gelistirme', 'debug']) assert.doesNotThrow(() => testKipiDenetle({ YIGIN_KIPI: k }));
});

test("Windows'ta pnpm komutları pnpm.cmd ile (PowerShell AllSigned politikası imzasız pnpm.ps1'i engeller)", () => {
  const launch = JSON.parse(oku('.vscode/launch.json'));
  for (const c of launch.configurations.filter((c) => c.type === 'node-terminal')) {
    assert.match(c.command, /^pnpm /, c.name);
    assert.equal(c.windows?.command, c.command.replace(/^pnpm /, 'pnpm.cmd '), c.name);
  }
  for (const t of JSON.parse(oku('.vscode/tasks.json')).tasks.filter((t) => /^pnpm /.test(t.command))) {
    assert.equal(t.windows?.command, t.command.replace(/^pnpm /, 'pnpm.cmd '), t.label);
  }
});

test('TDD özellik durumu (kırmızı/yeşil rozetler) yalnız gelistirme ve debug kipinde görünür; demo ve üretimde portal normal görünümde (D39)', () => {
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'gelistirme' }), 'true');
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'debug' }), 'true');
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'demo' }), 'false');
  assert.equal(ozellikDurumuGoster({}), 'false');
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'uretim' }), 'false');
  // Kabul testleri rozetleri doğrular: e2e her kipte görünür kipte koşar; üretim katmanı ise değeri her durumda kapatır
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'demo' }, { e2e: true }), 'true');
  assert.equal(ozellikDurumuGoster({ YIGIN_KIPI: 'uretim' }, { e2e: true }), 'false');
  // Değer verilmezse web normal görünümde açılır (Helm/üretim varsayılanı)
  assert.match(servis(oku('deploy/compose/compose.yml'), 'web'), /OZELLIK_DURUMU_GOSTER: \$\{OZELLIK_DURUMU_GOSTER:-false\}/);
  // Logo yanındaki kip etiketi: web kipi .env'deki YIGIN_KIPI'den alır (üretim katmanı uretim'e sabitler → etiket yok)
  assert.match(servis(oku('deploy/compose/compose.yml'), 'web'), /YIGIN_KIPI: \$\{YIGIN_KIPI:-demo\}/);
});

test("web'in kip ortamı yalnız kayıtlı kipten türer: eski GELISTIRME_KATMANI da gelistirme etiketi alır; e2e yalnız rozetleri açar", () => {
  assert.deepEqual(webKipOrtami({ YIGIN_KIPI: 'demo' }), { YIGIN_KIPI: 'demo', OZELLIK_DURUMU_GOSTER: 'false' });
  assert.deepEqual(webKipOrtami({ GELISTIRME_KATMANI: '1' }), { YIGIN_KIPI: 'gelistirme', OZELLIK_DURUMU_GOSTER: 'true' });
  assert.deepEqual(webKipOrtami({ YIGIN_KIPI: 'demo' }, { e2e: true }), { YIGIN_KIPI: 'demo', OZELLIK_DURUMU_GOSTER: 'true' });
  assert.deepEqual(webKipOrtami({ YIGIN_KIPI: 'uretim' }, { e2e: true }), { YIGIN_KIPI: 'uretim', OZELLIK_DURUMU_GOSTER: 'false' });
  // Kabukta kalmış değer demo yığınını rozetli açamaz: betik her compose çağrısında değeri kipten yeniden yazar (??= değil)
  const kaynak = oku('tools/deploy/yigin.mjs');
  assert.match(kaynak, /Object\.assign\(process\.env, webKipOrtami\(/);
  assert.doesNotMatch(kaynak, /process\.env\.OZELLIK_DURUMU_GOSTER \?\?=/);
});

test('sahte veri yalnız demo kipinde üretilir: diğer kiplerde gerçek veri bulunur', () => {
  // Hakan (29.10, 13:01): "sahte veriler sadece demo modunda çalışacak, diğer modlarda gerçek veriler olmalı".
  // Sahte GİB ve demo hesabı `profil`e bağlıdır (gelistirme/debug'da da açıktır); sentetik VERİ ona bağlı değildir.
  assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'demo' }), true);
  assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'gelistirme' }), false);
  assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'debug' }), false);
  assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'uretim' }), false);
  // Kabukta kalmış YIGIN_PROFIL=demo, demo dışı bir kipte sahte veri açamaz
  const eski = process.env.YIGIN_PROFIL;
  process.env.YIGIN_PROFIL = 'demo';
  try {
    assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'gelistirme' }), false);
    assert.equal(sahteVeriKipi({ YIGIN_KIPI: 'uretim' }), false);
  } finally {
    if (eski === undefined) delete process.env.YIGIN_PROFIL;
    else process.env.YIGIN_PROFIL = eski;
  }
});

test('dış entegrasyonlar: yalnız demo kipinde sahte GİB, diğer kiplerde canlı entegrasyon', () => {
  // Hakan (29.10, 14:56): "Demo modunda çalıştığında yalnızca demo/sahte bilgiler görülsün, canlı veri
  // göstermesin. Diğer bütün modlarda - geliştirme, debug, uretim gibi - canlı entegrasyon ile çalışıp
  // gerçek bilgileri göstersin."
  assert.equal(profil({ YIGIN_KIPI: 'demo' }), 'demo');
  assert.equal(profil({ YIGIN_KIPI: 'gelistirme' }), 'uretim');
  assert.equal(profil({ YIGIN_KIPI: 'debug' }), 'uretim');

  const demo = kurumOrtami({ YIGIN_KIPI: 'demo' });
  assert.equal(demo.EWORKS_ORTAM, 'demo');
  assert.match(demo.GIB_SAHTE_SUNUCU, /fake-gib/);

  for (const k of ['gelistirme', 'debug']) {
    const o = kurumOrtami({ YIGIN_KIPI: k });
    assert.equal(o.EWORKS_ORTAM, 'gelistirme', k);
    assert.equal(o.GIB_SAHTE_SUNUCU, '', k + ': sahte GİB kapalı olmalı');
  }

  const uretim = kurumOrtami({ YIGIN_KIPI: 'uretim' });
  assert.equal(uretim.EWORKS_ORTAM, 'uretim');
  assert.equal(uretim.GIB_SAHTE_SUNUCU, '');
});

test('Vault kök anahtarı kalıcıdır: üretilir, biçimi doğrudur ve ikinci çağrıda değişmez', async () => {
  // Supabase imajındaki pgsodium_getkey.sh anahtarı container dosya sisteminde arar ve yoksa rastgele üretir.
  // Bağlanmazsa container her yeniden oluşturulduğunda anahtar değişir ve saklanmış kurum şifreleri
  // "invalid ciphertext" ile çözülemez hale gelir (29.10'da yaşandı).
  const { mkdtempSync, readFileSync, readdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dizin = mkdtempSync(join(tmpdir(), 'eworks-vault-'));

  assert.equal(vaultAnahtarlari(dizin), VAULT_ANAHTARLI_DB.length);
  const dosyalar = readdirSync(join(dizin, 'vault-anahtarlari')).sort();
  assert.deepEqual(dosyalar, VAULT_ANAHTARLI_DB.map((d) => `${d}.key`).sort());

  const once = {};
  for (const d of dosyalar) {
    const icerik = readFileSync(join(dizin, 'vault-anahtarlari', d), 'utf8');
    assert.match(icerik, /^[0-9a-f]{64}$/, `${d}: 32 bayt, 64 haneli onaltılık, satır sonu yok olmalı`);
    once[d] = icerik;
  }

  // İkinci çağrı var olan anahtara dokunmaz: dokunsaydı eski şifreler okunamazdı
  assert.equal(vaultAnahtarlari(dizin), 0);
  for (const d of dosyalar) assert.equal(readFileSync(join(dizin, 'vault-anahtarlari', d), 'utf8'), once[d], `${d} değişmemeli`);

  // Her veritabanının anahtarı ayrıdır
  assert.equal(new Set(Object.values(once)).size, dosyalar.length);
});
