#!/usr/bin/env node
// Depo yeniden yapılanması (D28) sonrası makine başına bir kez çalıştırılır: git'in taşımadığı yerel dosyaları
// (gitignore'dakiler, izlenmeyenler) eski üst klasörlerden eski/ altına taşır ve eski yolları gösteren yerel ayarları düzeltir.
// Ayrıntı: docs/hedef-mimari/08-depo-yeniden-yapilanmasi.md §3a.
//
// Kullanım (depo kökünden):
//   node tools/ajan/eski-yerel-tasi.mjs             yalnız ne yapılacağını listeler (kuru çalıştırma)
//   node tools/ajan/eski-yerel-tasi.mjs --uygula    uygular
//   ... --jobs-sil                                  mert/**/jobs/ (kişisel veri içerir) taşımak yerine siler
//
// Ne yapar:
//   • eski üst klasörlerde (mukellef-takip, mert, hkazaz, hakan, yunus) kalan her şey izlenmeyen dosyadır (izlenenleri
//     git pull zaten taşıdı). Derleme çıktıları ve bağımlılıklar silinir (eski/ altında gerekirse yeniden kurulur),
//     jobs/ dizinleri uyarılır (--jobs-sil ile silinir), geri kalanlar eski/<aynı yol>'a taşınır.
//   • kökteki .mypy_cache silinir.
//   • kök .claude/settings.local.json içindeki autoMemoryDirectory eski ekip hafızasını gösteriyorsa yenisine çevrilir.
//   • git core.hooksPath eski mukellef-takip/.githooks ise tools/git-hooks yapılır.
// İdempotent: ikinci çalıştırmada yapılacak iş kalmaz. Yalnız Node yerleşik modülleri.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ESKI_KLASORLER = ['mukellef-takip', 'mert', 'hkazaz', 'hakan', 'yunus'];
const SILINECEK_DIZIN = new Set([
  'node_modules', 'dist', '.next', 'coverage', 'playwright-report', 'test-results', '.turbo',
  '.mypy_cache', '__pycache__', '.pytest_cache', '.ruff_cache',
]);
const silinecekMi = (yol, ad, dizin) =>
  (dizin && SILINECEK_DIZIN.has(ad)) ||
  (dizin && ad === 'generated' && /[\\/]src$/.test(dirname(yol))) ||
  (!dizin && (ad.endsWith('.tsbuildinfo') || ad === 'next-env.d.ts'));
const ESKI_HAFIZA = /[\\/]mukellef-takip[\\/]docs[\\/]ai[\\/]memory[\\/]?$/i;
const ESKI_KANCA = /^(?:\.\/)?mukellef-takip[\\/]\.githooks[\\/]?$/;

const SANAL_ORTAM = new Set(['.venv', '.ocr-venv', 'venv']);

/** Yapılacak işleri hesaplar; hiçbir şey değiştirmez. */
export function planla(kok, { jobsSil = false } = {}) {
  const isler = [];
  // Dizinin içinde silinecek ya da uyarılacak bir şey varsa bütün olarak taşınmaz, içine girilir
  const ozelIcerir = (mutlak) =>
    readdirSync(mutlak).some((ad) => {
      const yol = join(mutlak, ad);
      const st = lstatSync(yol);
      const dizin = st.isDirectory() && !st.isSymbolicLink();
      if (silinecekMi(yol, ad, dizin) || st.isSymbolicLink() || (dizin && ad === 'jobs')) return true;
      return dizin && !SANAL_ORTAM.has(ad) && ozelIcerir(yol);
    });
  const gez = (mutlak) => {
    for (const ad of readdirSync(mutlak)) {
      const yol = join(mutlak, ad);
      const st = lstatSync(yol);
      const dizin = st.isDirectory() && !st.isSymbolicLink();
      const gorece = relative(kok, yol).replaceAll('\\', '/');
      if (silinecekMi(yol, ad, dizin) || st.isSymbolicLink()) {
        isler.push({ tur: 'sil', yol: gorece });
      } else if (dizin && ad === 'jobs' && gorece.startsWith('mert/')) {
        isler.push({ tur: jobsSil ? 'sil' : 'uyar', yol: gorece, neden: 'jobs/ kişisel veri içerebilir; --jobs-sil ile silin' });
      } else if (dizin && !SANAL_ORTAM.has(ad) && (existsSync(join(kok, 'eski', gorece)) || ozelIcerir(yol))) {
        gez(yol); // hedefte dizin var ya da içinde ayıklanacak şey var: içeriği tek tek ele al
      } else if (existsSync(join(kok, 'eski', gorece))) {
        isler.push({ tur: 'uyar', yol: gorece, neden: `eski/${gorece} zaten var; elle karşılaştırın` });
      } else {
        isler.push({ tur: 'tasi', yol: gorece, hedef: `eski/${gorece}` });
      }
    }
  };
  for (const k of ESKI_KLASORLER) {
    if (existsSync(join(kok, k)) && lstatSync(join(kok, k)).isDirectory()) gez(join(kok, k));
  }
  if (existsSync(join(kok, '.mypy_cache'))) isler.push({ tur: 'sil', yol: '.mypy_cache' });

  const yerel = join(kok, '.claude', 'settings.local.json');
  if (existsSync(yerel)) {
    try {
      const ayar = JSON.parse(readFileSync(yerel, 'utf8'));
      if (typeof ayar.autoMemoryDirectory === 'string' && ESKI_HAFIZA.test(ayar.autoMemoryDirectory)) {
        isler.push({ tur: 'hafiza', yol: '.claude/settings.local.json', hedef: join(kok, 'docs', 'ai', 'memory') });
      }
    } catch {
      isler.push({ tur: 'uyar', yol: '.claude/settings.local.json', neden: 'JSON okunamadı' });
    }
  }
  let kanca = '';
  try {
    kanca = execFileSync('git', ['config', '--local', '--get', 'core.hooksPath'], { cwd: kok, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    // Ayar yok.
  }
  if (ESKI_KANCA.test(kanca)) isler.push({ tur: 'kanca', yol: kanca, hedef: 'tools/git-hooks' });
  return isler;
}

/** Planı uygular; boşalan eski üst klasörleri kaldırır. */
export function uygula(kok, isler) {
  for (const is of isler) {
    const yol = join(kok, is.yol);
    if (is.tur === 'sil') rmSync(yol, { recursive: true, force: true });
    if (is.tur === 'tasi') {
      mkdirSync(dirname(join(kok, is.hedef)), { recursive: true });
      renameSync(yol, join(kok, is.hedef));
    }
    if (is.tur === 'hafiza') {
      const ayar = JSON.parse(readFileSync(yol, 'utf8'));
      ayar.autoMemoryDirectory = is.hedef;
      writeFileSync(yol, JSON.stringify(ayar, null, 2) + '\n');
    }
    if (is.tur === 'kanca') execFileSync('git', ['config', '--local', 'core.hooksPath', is.hedef], { cwd: kok });
  }
  const bosalt = (d) => {
    if (!existsSync(d) || !lstatSync(d).isDirectory()) return;
    for (const ad of readdirSync(d)) bosalt(join(d, ad));
    if (readdirSync(d).length === 0) rmdirSync(d);
  };
  for (const k of ESKI_KLASORLER) bosalt(join(kok, k));
}

const ETIKET = { sil: 'sil   ', tasi: 'taşı  ', uyar: 'UYARI ', hafiza: 'ayar  ', kanca: 'kanca ' };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kok = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const args = new Set(process.argv.slice(2));
  const isler = planla(kok, { jobsSil: args.has('--jobs-sil') });
  if (isler.length === 0) {
    console.log('✔ Yapılacak iş yok: bu makinede eski yollarda yerel dosya veya eski ayar kalmamış.');
    process.exit(0);
  }
  for (const is of isler) {
    const ek = is.hedef ? ` → ${is.hedef}` : is.neden ? ` (${is.neden})` : '';
    console.log(`${ETIKET[is.tur]} ${is.yol}${ek}`);
  }
  if (!args.has('--uygula')) {
    console.log(`\n${isler.length} iş listelendi (kuru çalıştırma). Uygulamak için: node tools/ajan/eski-yerel-tasi.mjs --uygula`);
    process.exit(0);
  }
  uygula(kok, isler);
  const uyarilar = isler.filter((i) => i.tur === 'uyar').length;
  console.log(`\n✔ Uygulandı (${isler.length - uyarilar} iş${uyarilar ? `, ${uyarilar} uyarı elle bakılmalı` : ''}). Claude Code'da yeni oturum açın.`);
}
