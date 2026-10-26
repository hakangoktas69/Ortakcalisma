#!/usr/bin/env node
// Belge gezinti yolu: kapsamdaki her belgenin en üstüne ve en altına kökten belgeye uzanan tıklanabilir yol yazar
// (README › Genel bakış › … › **bu belge**). Markdown okurun nereden geldiğini bilemez; "geri" yerine üst belgelere dönülür.
// Hiyerarşinin tek kaynağı aşağıdaki TABLO'dur; kapsamdaki yeni belge tabloya eklenmezse denetim hata verir.
// Kullanım: node tools/docs/gezinti.mjs [--yaz]   (bayraksız: yalnız denetler, eksik/eski blokta 1 ile çıkar)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOK = 'README.md';
const BAS = '<!-- gezinti — node tools/docs/gezinti.mjs --yaz üretir, elle düzenlemeyin -->';
const SON = '<!-- /gezinti -->';

const GENEL = 'docs/00-genel-bakis.md';
const HEDEF = 'docs/hedef-mimari/01-cok-kiracili-hedef-mimari.md';
const ADR = 'docs/adr/README.md';
const BAGLAM = 'docs/baglamlar/README.md';

/** yol → { ebeveyn, etiket }. Ebeveyn kök README ya da tablodaki bir belgedir. */
export const TABLO = {
  [GENEL]: { ebeveyn: KOK, etiket: 'Genel bakış' },
  'docs/gelistirici-rehberi/baslangic.md': { ebeveyn: GENEL, etiket: 'Başlangıç rehberi' },
  'docs/gelistirici-rehberi/terimler.md': { ebeveyn: GENEL, etiket: 'Terimler' },
  'docs/gelistirici-rehberi/vps-kurulum.md': { ebeveyn: 'docs/gelistirici-rehberi/baslangic.md', etiket: 'VPS kurulumu' },
  'docs/gelistirici-rehberi/kipler.md': { ebeveyn: 'docs/gelistirici-rehberi/baslangic.md', etiket: 'Yığın kipleri' },
  'docs/gelistirici-rehberi/ddd-nedir.md': { ebeveyn: GENEL, etiket: 'DDD nedir' },
  'docs/gelistirici-rehberi/ddd.md': { ebeveyn: GENEL, etiket: 'DDD rehberi' },
  'docs/gelistirici-rehberi/tdd-nedir.md': { ebeveyn: GENEL, etiket: 'TDD nedir' },
  'docs/gelistirici-rehberi/tdd.md': { ebeveyn: GENEL, etiket: 'TDD rehberi' },
  'docs/gelistirici-rehberi/claude-codex.md': { ebeveyn: GENEL, etiket: 'Claude Code ve Codex' },
  'docs/gelistirici-rehberi/canli-dogrulama.md': { ebeveyn: GENEL, etiket: 'Canlı GİB doğrulaması' },
  'docs/ai/vizyon.md': { ebeveyn: GENEL, etiket: 'Vizyon' },
  'docs/ai/mimari.md': { ebeveyn: GENEL, etiket: 'Mimari' },
  'docs/ai/kurallar.md': { ebeveyn: GENEL, etiket: 'Kurallar' },
  'docs/ai/test.md': { ebeveyn: GENEL, etiket: 'Test' },
  'docs/ai/durum.md': { ebeveyn: GENEL, etiket: 'Durum' },
  'docs/ozellik-durumu.md': { ebeveyn: GENEL, etiket: 'Özellik durumu' },
  [HEDEF]: { ebeveyn: GENEL, etiket: '01 Hedef mimari' },
  'docs/hedef-mimari/02-kurum-entegrasyon-robotu.md': { ebeveyn: HEDEF, etiket: '02 Kurum entegrasyonu' },
  'docs/hedef-mimari/03-kaynak-verimliligi-ve-kapasite.md': { ebeveyn: HEDEF, etiket: '03 Kapasite' },
  'docs/hedef-mimari/04-dagitim-compose-kubernetes.md': { ebeveyn: HEDEF, etiket: '04 Dağıtım' },
  'docs/hedef-mimari/05-yetki-ve-hesap-modeli.md': { ebeveyn: HEDEF, etiket: '05 Yetki ve hesap' },
  'docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md': { ebeveyn: HEDEF, etiket: '06 Kaynak kod (DDD/TDD)' },
  'docs/hedef-mimari/07-veri-saklama-ve-sharding.md': { ebeveyn: HEDEF, etiket: '07 Veri ve sharding' },
  'docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md': { ebeveyn: HEDEF, etiket: '08 Depo yeniden yapılanması' },
  'docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md': { ebeveyn: HEDEF, etiket: '09 Ajan bağlamı' },
  [ADR]: { ebeveyn: GENEL, etiket: 'Karar kayıtları' },
  'docs/adr/karar-kaydi.md': { ebeveyn: ADR, etiket: 'Karar kaydı' },
  'docs/adr/0001-depo-yeniden-yapilanmasi.md': { ebeveyn: ADR, etiket: 'ADR 0001' },
  [BAGLAM]: { ebeveyn: GENEL, etiket: 'Bağlamlar' },
  ...Object.fromEntries(
    ['identity-access', 'organization', 'portfolio', 'credentials', 'sync', 'tax-filing', 'social-security', 'documents', 'workspace', 'notifications', 'audit', 'sales']
      .map((ad) => [`docs/baglamlar/${ad}.md`, { ebeveyn: BAGLAM, etiket: ad }]),
  ),
  'deploy/README.md': { ebeveyn: KOK, etiket: 'Docker ve Kubernetes' },
  'services/integration/README.md': { ebeveyn: KOK, etiket: 'Kurum entegrasyonu (ACL)' },
};

/** docs/ altındaki belgeler kapsamdadır; arşiv, ekip hafızası ve beceri kaynakları hariç. Tablodaki diğer belgeler de. */
const kapsamda = (yol, tablo) => (/^docs\/.+\.md$/.test(yol) && !/^docs\/(arsiv|ai\/memory|ai\/beceriler)\//.test(yol)) || yol in tablo;

/** Belgenin kökten kendisine uzanan yol satırı; tabloda yoksa null. */
export function yolSatiri(yol, tablo = TABLO) {
  if (!tablo[yol]) return null;
  const zincir = [];
  for (let y = yol; y !== KOK; y = tablo[y].ebeveyn) zincir.unshift(y);
  const dizin = posix.dirname(yol);
  const bag = (y, etiket) => `[${etiket}](${posix.relative(dizin, y)})`;
  return [bag(KOK, 'README'), ...zincir.slice(0, -1).map((y) => bag(y, tablo[y].etiket)), `**${tablo[yol].etiket}**`].join(' › ');
}

/** Metnin başındaki ve sonundaki gezinti bloklarını kaldırıp yenisini yazar; satır sonu (CRLF/LF) korunur. */
export function uygula(metin, satir) {
  const crlf = metin.includes('\r\n');
  let govde = metin.replace(/\r\n/g, '\n');
  if (govde.startsWith('<!-- gezinti')) {
    const i = govde.indexOf(SON);
    if (i >= 0) govde = govde.slice(i + SON.length);
  }
  govde = govde.replace(/^\n+/, '').replace(/\s+$/, '');
  if (govde.endsWith(SON)) {
    const i = govde.lastIndexOf('<!-- gezinti');
    if (i >= 0) govde = govde.slice(0, i).replace(/\s+$/, '');
  }
  const out = `${BAS}\n${satir}\n${SON}\n\n${govde}\n\n${BAS}\n\n---\n\n${satir}\n${SON}\n`;
  return crlf ? out.replace(/\n/g, '\r\n') : out;
}

export function denetle(kok, { tablo = TABLO, yaz = false } = {}) {
  const dosyalar = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '*.md'], { cwd: kok, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && kapsamda(f, tablo) && existsSync(join(kok, f)));
  const sorunlar = [];
  for (const f of dosyalar) {
    const satir = yolSatiri(f, tablo);
    if (!satir) {
      sorunlar.push(`${f}: gezinti TABLO'sunda yok; tools/docs/gezinti.mjs içine ebeveyn ve etiketiyle ekle`);
      continue;
    }
    const metin = readFileSync(join(kok, f), 'utf8');
    const yeni = uygula(metin, satir);
    if (yeni === metin) continue;
    if (yaz) writeFileSync(join(kok, f), yeni);
    else sorunlar.push(`${f}: gezinti bloğu eksik ya da eski; node tools/docs/gezinti.mjs --yaz`);
  }
  return { dosya: dosyalar.length, sorunlar };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kok = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const { dosya, sorunlar } = denetle(kok, { yaz: process.argv.includes('--yaz') });
  for (const s of sorunlar) console.error(`✖ ${s}`);
  if (sorunlar.length > 0) process.exit(1);
  console.log(`✔ Gezinti yolu: ${dosya} belge güncel`);
}
