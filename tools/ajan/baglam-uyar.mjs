#!/usr/bin/env node
// git kancaları (post-merge, post-checkout) için: iki sürüm arasında ajan bağlamı değiştiyse uyarı yazar.
// Kullanım: node tools/ajan/baglam-uyar.mjs <eski-ref> <yeni-ref>
import { baglamDosyasiMi, git, KOK } from './ortak.mjs';

const [once, sonra] = process.argv.slice(2);
try {
  const degisen = git(KOK, ['diff', '--name-only', once, sonra]).split('\n').filter((f) => f && baglamDosyasiMi(f));
  if (degisen.length > 0) {
    console.error('⚠ Ajan bağlamı değişti — açık Claude Code / Codex oturumları eski bağlamla çalışıyor; yeni oturum açın:');
    for (const f of degisen.slice(0, 15)) console.error(`  ${f}`);
    if (degisen.length > 15) console.error(`  … ve ${degisen.length - 15} dosya daha`);
  }
} catch {
  // İlk checkout, geçersiz ref vb.; sessiz geç.
}
