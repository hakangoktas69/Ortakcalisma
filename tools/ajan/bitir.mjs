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
    '2. Değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını, yetki anahtarını veya teknoloji kararını etkilediyse kaynak belgeyi aynı değişiklikte güncelle: CLAUDE.md / alt dizin CLAUDE.md, docs/ai/*.md, docs/baglamlar/<context>.md; karar ise docs/adr/karar-kaydi.md + docs/hedef-mimari/01 (D-NN) + docs/ai/durum.md + ekip hafızası (eworks-hedef-mimari); durum değiştiyse docs/ai/durum.md. AGENTS.md\'ye kural yazma (üretilir).',
    `3. ${hafizaAdimi}`,
    '4. Kod değiştiyse DDD/TDD denetimi (docs/ai/beceriler/gelistir.md): değişiklik doğru bağlamda ve katmanda mı (domain saf, başka bağlama yalnız index.ts/port/olay, başka bağlamın tablosu yok); her yeni davranış için önce kırmızı görülen test var mı; yeni özellikse feature-registry anahtarı ve @F:<anahtar> etiketli kabul testi; yeni sayfa/uç sayfaIzni/apiIzni ile kayıttaki anahtarı bildiriyor mu; migration varsa RLS + pgTAP. Etiketi yalnız özelliği gerçekten doğrulayan teste koy; testi zayıflatma, skip bırakma, kapsam eşiğini düşürme. Belge değiştirdiysen göreli bağlantılar ve mermaid.',
    '5. Kod değiştiyse tutarlılık ve güvenlik (gelistir C1, C4): plan ile git diff örtüşüyor mu; iş modeli yanıtlarının (kim görür/göremez, kapsam, onay, maskeleme) ve öngörülen hata durumlarının her biri bir testte mi; altyapı hatası loglanmadan yutulmuyor, loga kişisel veri/şifre/token girmiyor; diff\'te hata ayıklama kodu, TODO, skip, sır kalmadı.',
    '6. Belgeleri veya hafızayı değiştirdiysen node tools/ajan/senkron.mjs --yaz (pre-commit kancası da çalıştırır), sonra pnpm verify (tip, mimari, birim testleri + kapsam eşiği, yetki anahtarı denetimi, hafıza, senkron, bağlantılar); Node 24 yoksa sh tools/deploy/dogrula.sh. Entegrasyon/migration değiştiyse node tools/deploy/yigin.mjs test. Arayüz değiştiyse node tools/deploy/yigin.mjs e2e (dört ekran) ve değişen ekranın 375 ile 1366 genişlikte görüntüsünü alıp UX kontrol listesiyle incele (gelistir C3). Koşamadığın doğrulamayı geçti diye raporlama.',
    '7. Kullanıcıya sade rapor (gelistir C5): iş dilinde ne değişti, hangi test kırmızıdan yeşile döndü, ne koşulamadı ve neden, kalan risk, elle bakılacak yer. Değişiklikleri commitle (Türkçe başlık). Push etme; kullanıcı ister.',
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
