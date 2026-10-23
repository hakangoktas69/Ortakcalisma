#!/usr/bin/env node
// İşi bitir (commit/push öncesi). Claude ve Codex için AYNI adımlar (D31 karşılıklılığı burada sağlanır):
// senkron her durumda iki tarafı da kurar — Claude kullandıysan Codex dosyaları (AGENTS.md, beceri eşlemesi),
// Codex kullandıysan Claude dosyaları (MEMORY.md dizini, .claude/skills) güncellenir.
//
//   node tools/ajan/bitir.mjs --ajan claude|codex
// Önce senkronu (--yaz) ve hafıza denetimini çalıştırır, sonuçlarını ve ajanın uygulayacağı adımları yazdırır.
// Claude'da Stop kancası, Codex'te AGENTS.md talimatı çalıştırır; insan da çalıştırıp çıktıyı oturuma yapıştırabilir.
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KOK } from './ortak.mjs';
import { yaz } from './senkron.mjs';

export function bitirMetni(ajan, { senkron, hafiza }) {
  const hafizaAdimi =
    ajan === 'codex'
      ? 'Kodda görünmeyen öğrenilmiş bir bilgi varsa docs/ai/memory altına AGENTS.md "Ekip hafızası" biçimiyle yaz (MEMORY.md satırını senkron tamamlar).'
      : 'Kodda görünmeyen öğrenilmiş bir bilgi varsa /hafiza ile ekip hafızasına yaz.';
  return [
    'İş bitirme adımları (hepsini uygula; koşulamayanı kullanıcıya açıkça söyle):',
    `Ön kontrol — senkron: ${senkron}; ekip hafızası: ${hafiza}.`,
    '1. Değişikliklerini git status ve git diff ile gözden geçir.',
    '2. Değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını, yetki anahtarını veya teknoloji kararını etkilediyse kaynak belgeyi aynı değişiklikte güncelle: CLAUDE.md / apps/*/CLAUDE.md, docs/ai/*.md, docs/baglamlar/<context>.md; karar ise docs/adr/karar-kaydi.md + docs/hedef-mimari/01 (D-NN) + docs/ai/durum.md + ekip hafızası (eworks-hedef-mimari); durum değiştiyse docs/ai/durum.md. AGENTS.md\'ye kural yazma (üretilir).',
    `3. ${hafizaAdimi}`,
    '4. Yeni özellikse feature-registry anahtarı ve @F:<anahtar> etiketli testler (docs/ai/test.md). Belge değiştirdiysen göreli bağlantılar ve mermaid.',
    '5. Belgeleri veya hafızayı değiştirdiysen node tools/ajan/senkron.mjs --yaz (pre-commit kancası da çalıştırır), sonra pnpm verify (tip, mimari, testler, hafıza, senkron, bağlantılar); Node 24 yoksa node:24 container\'ında.',
    '6. Neleri güncellediğini listele ve değişiklikleri commitle (Türkçe başlık). Push etme; kullanıcı ister.',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--ajan');
  const ajan = i > 0 ? process.argv[i + 1] : '';
  if (ajan !== 'claude' && ajan !== 'codex') {
    console.error('Kullanım: node tools/ajan/bitir.mjs --ajan claude|codex');
    process.exit(2);
  }
  let senkron;
  try {
    const d = yaz(KOK);
    senkron = d.length > 0 ? `üretilen dosyalar güncellendi ve sahnelendi (${d.join(', ')})` : 'güncel';
  } catch (err) {
    senkron = `çalıştırılamadı (${err.message})`;
  }
  let hafiza;
  try {
    execFileSync(process.execPath, [join(KOK, 'tools', 'claude', 'check-memory.mjs')], { cwd: KOK, encoding: 'utf8', stdio: 'pipe' });
    hafiza = 'yeşil';
  } catch (err) {
    hafiza = `KIRMIZI — düzelt:\n${String(err.stderr || err.message).trim()}`;
  }
  console.log(bitirMetni(ajan, { senkron, hafiza }));
}
