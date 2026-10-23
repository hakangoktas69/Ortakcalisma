#!/usr/bin/env node
// Belge bağlantı denetimi: izlenen tüm *.md dosyalarındaki göreli Markdown bağlantıları ve CLAUDE.md @içe aktarımları
// gerçekten var olan bir dosyayı/dizini göstermeli. Dış adresler (http, mailto) ve yalnız çapa (#…) denetlenmez.
// Kullanım: node tools/docs/baglanti-denetle.mjs [--dahil eski]   (eski/ arşivi varsayılan olarak atlanır)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bir Markdown metnindeki göreli hedefleri döner (kod blokları ve satır içi kod hariç). */
export function hedefler(metin, dosyaAdi = '') {
  const temiz = metin.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const out = [];
  for (const m of temiz.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  if (/^CLAUDE(\.local)?\.md$/.test(dosyaAdi)) {
    for (const m of temiz.matchAll(/^\s*-?\s*@([\w./-]+\.md)\b/gm)) out.push(m[1]);
  }
  return out.filter((h) => !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(h));
}

export function denetle(kok, { eskiDahil = false } = {}) {
  const dosyalar = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '*.md'], { cwd: kok, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((f) => eskiDahil || !f.startsWith('eski/'))
    .filter((f) => existsSync(join(kok, f)));
  const kirik = [];
  for (const f of dosyalar) {
    const metin = readFileSync(join(kok, f), 'utf8');
    for (const h of hedefler(metin, f.split('/').pop())) {
      const yol = decodeURIComponent(h.split('#')[0]);
      if (!yol) continue;
      if (!existsSync(resolve(kok, dirname(f), yol))) kirik.push(`${f}: ${h}`);
    }
  }
  return { dosya: dosyalar.length, kirik };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const kok = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const { dosya, kirik } = denetle(kok, { eskiDahil: process.argv.includes('eski') });
  for (const k of kirik) console.error(`✖ ${k}`);
  if (kirik.length > 0) {
    console.error(`✖ ${kirik.length} kırık bağlantı (${dosya} belge)`);
    process.exit(1);
  }
  console.log(`✔ Bağlantı denetimi: ${dosya} belge, kırık bağlantı yok`);
}
