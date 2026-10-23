// tools/ajan ve tools/claude betiklerinin ortak yardımcıları. Yalnız Node yerleşik modülleri.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KANCA_DIZINI = 'tools/git-hooks';

// Ajanların bağlamını oluşturan dosyalar: değişirse oturum başında yüklenen sürümler eskir
export const BAGLAM_YOLLARI = ['CLAUDE.md', 'AGENTS.md', 'apps', 'packages', 'docs/ai', 'docs/adr', 'docs/baglamlar', 'docs/hedef-mimari'];
export const baglamDosyasiMi = (yol) =>
  /(^|\/)(CLAUDE|AGENTS)\.md$/.test(yol) || /^docs\/(ai|adr|baglamlar|hedef-mimari)\//.test(yol);

/** Yeniden yapılanma öncesi ekip hafızası (D28); yerel ayarda görülürse yenisiyle değiştirilir. */
export const ESKI_HAFIZA = /[\\/]mukellef-takip[\\/]docs[\\/]ai[\\/]memory[\\/]?$/i;
export const ESKI_KANCA = /^(?:\.\/)?mukellef-takip[\\/]\.githooks[\\/]?$/;

export const git = (kok, args, secenek = {}) =>
  execFileSync('git', args, { cwd: kok, encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'], ...secenek });

export const gitDeposuMu = (kok) => {
  try {
    return git(kok, ['rev-parse', '--is-inside-work-tree']).trim() === 'true';
  } catch {
    return false;
  }
};

export const ayniYol = (a, b) => {
  const norm = (p) => resolve(p.replace(/^~(?=[\\/]|$)/, homedir())).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

/**
 * Claude Code'un yerel ayarına (.claude/settings.local.json) ekip hafızası dizinini yazar.
 * Yoksa ekler, bilinen eski yolsa düzeltir, başka bir değerse dokunmaz.
 * Dönüş: 'eklendi' | 'duzeltildi' | 'ayni' | { farkli: <değer> }
 */
export function hafizaAyariniKur(kok, oturumDizini = kok) {
  const yerel = join(oturumDizini, '.claude', 'settings.local.json');
  const hedef = join(kok, 'docs', 'ai', 'memory');
  const ayar = existsSync(yerel) ? JSON.parse(readFileSync(yerel, 'utf8')) : {};
  const simdiki = ayar.autoMemoryDirectory;
  let sonuc;
  if (simdiki === undefined) sonuc = 'eklendi';
  else if (ayniYol(simdiki, hedef)) return 'ayni';
  else if (ESKI_HAFIZA.test(simdiki)) sonuc = 'duzeltildi';
  else return { farkli: simdiki };
  ayar.autoMemoryDirectory = hedef;
  mkdirSync(dirname(yerel), { recursive: true });
  writeFileSync(yerel, JSON.stringify(ayar, null, 2) + '\n');
  return sonuc;
}

/** git core.hooksPath'i tools/git-hooks yapar (yoksa ya da eski yolsa). Dönüş: 'kuruldu' | 'ayni' | { farkli } | 'git-yok' */
export function kancalariKur(kok) {
  if (!gitDeposuMu(kok)) return 'git-yok';
  let simdiki = '';
  try {
    simdiki = git(kok, ['config', '--local', '--get', 'core.hooksPath']).trim();
  } catch {
    // Ayar yok.
  }
  if (simdiki === KANCA_DIZINI) return 'ayni';
  if (simdiki && !ESKI_KANCA.test(simdiki)) return { farkli: simdiki };
  git(kok, ['config', '--local', 'core.hooksPath', KANCA_DIZINI]);
  return 'kuruldu';
}

/** Basit ön bilgi (frontmatter) okuyucu: düz anahtarlar ve bir düzey iç içe nesne. */
export function onBilgi(metin) {
  const m = metin.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let ust = null;
  for (const satir of m[1].split(/\r?\n/)) {
    const kv = satir.match(/^(\s*)([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, girinti, anahtar, deger] = kv;
    const temiz = deger.replace(/^(["'])(.*)\1$/, '$2');
    if (girinti.length === 0) {
      ust = deger === '' ? anahtar : null;
      out[anahtar] = deger === '' ? {} : temiz;
    } else if (ust) {
      out[ust][anahtar] = temiz;
    }
  }
  return out;
}
