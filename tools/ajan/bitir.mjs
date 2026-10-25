#!/usr/bin/env node
// İşi bitir (commit/push öncesi). Claude ve Codex için AYNI adımlar (D31 karşılıklılığı burada sağlanır):
// senkron her durumda iki tarafı da kurar — Claude kullandıysan Codex dosyaları (AGENTS.md, beceri eşlemesi),
// Codex kullandıysan Claude dosyaları (MEMORY.md dizini, .claude/skills) güncellenir.
//
//   node tools/ajan/bitir.mjs --ajan claude|codex
// Önce senkronu (--yaz) ve hafıza denetimini çalıştırır; dalı ve iş dalında değişen hassas alanları (D37) bulur;
// sonuçlarını ve ajanın uygulayacağı adımları yazdırır.
// Claude'da Stop kancası, Codex'te AGENTS.md talimatı çalıştırır; insan da çalıştırıp çıktıyı oturuma yapıştırabilir.
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, hassasAlanlar, KOD_SAHIBI, KOK, ORTAK_DALLAR, ortakDalMi } from './ortak.mjs';
import { yaz } from './senkron.mjs';

const refVar = (kok, ref) => {
  try {
    git(kok, ['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
};

/** İş dalında ortak dallarda olmayan commitlerin ve commitlenmemiş değişikliklerin dosyaları. */
export function degisenDosyalar(kok) {
  const ortak = ORTAK_DALLAR.flatMap((d) => [`refs/heads/${d}`, `refs/remotes/origin/${d}`]).filter((r) => refVar(kok, r));
  const satirlar = (metin) => metin.split('\n').filter((s) => s.trim() !== '');
  // Karşılaştırılacak ortak dal yoksa tüm geçmiş "değişmiş" sayılmasın: yalnız çalışma ağacına bakılır
  const commitli =
    ortak.length > 0 ? satirlar(git(kok, ['-c', 'core.quotepath=false', 'log', '--name-only', '--format=', 'HEAD', '--not', ...ortak])) : [];
  // porcelain: "XY yol" ya da yeniden adlandırmada "XY eski -> yeni"
  const calisma = satirlar(git(kok, ['-c', 'core.quotepath=false', 'status', '--porcelain', '-uall'])).map((s) =>
    s.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''),
  );
  return [...new Set([...commitli, ...calisma])].sort();
}

/** Dal ve hassas alanlar; biri alınamazsa (ayrık HEAD, ilk commit yok) öteki yine hesaplanır. */
export function durumTopla(kok) {
  let dal = '';
  let hassas = [];
  try {
    dal = git(kok, ['symbolic-ref', '--short', '-q', 'HEAD']).trim();
  } catch {
    // ayrık HEAD (rebase, CI checkout)
  }
  try {
    hassas = hassasAlanlar(degisenDosyalar(kok));
  } catch {
    // git yok ya da henüz commit yok
  }
  return { dal, hassas };
}

export function bitirMetni(ajan, { senkron, hafiza, dal, hassas }) {
  const hafizaAdimi =
    ajan === 'codex'
      ? 'Kodda görünmeyen öğrenilmiş bir bilgi varsa docs/ai/memory altına AGENTS.md "Ekip hafızası" biçimiyle yaz (MEMORY.md satırını senkron tamamlar).'
      : 'Kodda görünmeyen öğrenilmiş bir bilgi varsa /hafiza ile ekip hafızasına yaz.';
  const incelemeAdimi =
    ajan === 'codex'
      ? 'kullanıcıdan Codex\'in /review komutunu bu dalda çalıştırmasını iste'
      : 'code-review becerisini çalıştır; hassas alan değiştiyse ayrıca security-review';
  const uyarilar = [];
  if (ortakDalMi(dal)) {
    uyarilar.push(`⚠ Ortak daldasın (${dal}): commit etmeden önce kişisel dal aç: git switch -c <ad>/<kısa-iş> (değişiklikler taşınır). pre-commit kancası ortak dala commit'i reddeder.`);
  }
  if (hassas.length > 0) {
    uyarilar.push(
      [
        `⚠ Kıdemli onayı gerekli (${KOD_SAHIBI}) — hassas alan değişti; birlestir.mjs dev bunu birleştirme mesajına ekler, kod sahibi dev → main birleşiminde onaylar:`,
        ...hassas.map((h) => `   • ${h.neden}: ${h.dosyalar.join(', ')}`),
      ].join('\n'),
    );
  }
  return [
    'İş bitirme adımları (hepsini uygula; koşulamayanı kullanıcıya açıkça söyle):',
    `Ön kontrol — senkron: ${senkron}; ekip hafızası: ${hafiza}; dal: ${dal || '(ayrık HEAD)'}.`,
    ...uyarilar,
    '1. Değişikliklerini git status ve git diff ile gözden geçir.',
    '2. Değişiklik mimariyi, bir kuralı, ucu, olayı, bağlam sınırını, yetki anahtarını veya teknoloji kararını etkilediyse kaynak belgeyi aynı değişiklikte güncelle: CLAUDE.md / alt dizin CLAUDE.md, docs/ai/*.md, docs/baglamlar/<context>.md; karar ise docs/adr/karar-kaydi.md + docs/hedef-mimari/01 (D-NN) + docs/ai/durum.md + ekip hafızası (eworks-hedef-mimari); durum değiştiyse docs/ai/durum.md. AGENTS.md\'ye kural yazma (üretilir).',
    `3. ${hafizaAdimi}`,
    '4. Kod değiştiyse DDD/TDD denetimi (docs/ai/beceriler/gelistir.md): değişiklik doğru bağlamda ve katmanda mı (domain saf, başka bağlama yalnız index.ts/port/olay, başka bağlamın tablosu yok); her yeni davranış için önce kırmızı görülen test var mı; yeni özellikse feature-registry anahtarı ve @F:<anahtar> etiketli kabul testi; yeni sayfa/uç sayfaIzni/apiIzni ile kayıttaki anahtarı bildiriyor mu; migration varsa RLS + pgTAP ve geri alma planı. Etiketi yalnız özelliği gerçekten doğrulayan teste koy; testi zayıflatma, skip bırakma, kapsam eşiğini düşürme. Belge değiştirdiysen göreli bağlantılar ve mermaid.',
    '5. Kod değiştiyse tutarlılık ve güvenlik (gelistir C1, C4): plan ile git diff örtüşüyor mu; iş modeli yanıtlarının (kim görür/göremez, kapsam, onay, maskeleme) ve öngörülen hata durumlarının her biri bir testte mi; altyapı hatası loglanmadan yutulmuyor, loga kişisel veri/şifre/token girmiyor; diff\'te hata ayıklama kodu, TODO, skip, sır kalmadı; yeni bağımlılığın lisansı ve güvenlik açığı denetlendi (gelistir B2).',
    `6. Kod değiştiyse bağımsız inceleme (gelistir C4): ${incelemeAdimi}. Her bulguyu düzelt ya da neden düzeltmediğini rapora yaz.`,
    '7. Belgeleri veya hafızayı değiştirdiysen node tools/ajan/senkron.mjs --yaz (pre-commit kancası da çalıştırır), sonra pnpm verify (tip, mimari, birim testleri + kapsam eşiği, yetki anahtarı denetimi, hafıza, senkron, bağlantılar); Node 24 yoksa sh tools/deploy/dogrula.sh. Entegrasyon/migration değiştiyse node tools/deploy/yigin.mjs test. Arayüz değiştiyse node tools/deploy/yigin.mjs e2e (dört ekran, erişilebilirlik taraması dahil) ve değişen ekranın 375 ile 1366 genişlikte görüntüsünü alıp UX kontrol listesiyle incele (gelistir C3). Koşamadığın doğrulamayı geçti diye raporlama.',
    '8. Kişisel dalda commitle (Türkçe başlık). Kullanıcıya sade rapor (gelistir C5): iş dilinde ne değişti, hangi test kırmızıdan yeşile döndü, ne koşulamadı ve neden, kalan risk, kıdemli onayı, elle bakılacak yer.',
    "9. dev'e birleştir (gelistir C6): node tools/ajan/birlestir.mjs guncelle — çatışma varsa kişisel dalda, iki tarafın amacını kodda analiz ederek çöz (amaçlar çelişiyorsa ya da hassas alandaysa kullanıcıya sor), sonra doğrulamaları yeniden koş; ardından node tools/ajan/birlestir.mjs dev --mesaj \"<başlık>\\n\\n<kısa rapor>\". dev'i push etme; her seferinde kullanıcı onayı iste. main'e birleştirmeyi kod sahibi yapar.",
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
  console.log(bitirMetni(ajan, { senkron, hafiza, ...durumTopla(KOK) }));
}
