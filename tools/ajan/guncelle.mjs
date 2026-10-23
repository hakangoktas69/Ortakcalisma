#!/usr/bin/env node
// Ekipten gelen değişiklikleri al (oturum başı). Claude ve Codex için aynı adımlar; --ajan yalnız metni değiştirir.
//
//   node tools/ajan/guncelle.mjs --ajan claude|codex          AJAN MODU: ajanın kendisi çalıştırır (Claude SessionStart
//        kancası, Codex AGENTS.md talimatı). Yalnız güvenliyse ileri sarar (temiz ağaç, ayrışmamış dal, ff-only),
//        senkronu çalıştırır; çıktısı ajana talimattır, ekip değişikliği yoksa boştur.
//   node tools/ajan/guncelle.mjs --ajan claude|codex --cek    İNSAN MODU: git pull; özet stderr'e, yeni oturum için
//        istem stdout'a (claude.ps1 / codex.ps1 bunu ajana verir ya da panoya kopyalar). Değişiklik yoksa istem boştur.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baglamDosyasiMi, git, KOK } from './ortak.mjs';
import { yaz } from './senkron.mjs';

const degisenBaglam = (kok, aralik) =>
  git(kok, ['diff', '--name-only', aralik]).split('\n').filter((f) => f && baglamDosyasiMi(f));

/** Ajan modu: ajana verilecek talimat metnini döner (boş = yapılacak bir şey yok). */
export function ajanGuncelle(kok, ajan) {
  const betik = `node tools/ajan/guncelle.mjs --ajan ${ajan} --cek`;
  let ust;
  try {
    ust = git(kok, ['rev-parse', '--abbrev-ref', '@{u}']).trim();
  } catch {
    return '';
  }
  try {
    git(kok, ['fetch', '--quiet'], { timeout: 15000 });
  } catch {
    return `Ekip senkronu: git fetch yapılamadı (ağ ya da izin yok); ekipten gelen değişiklikler denetlenmedi. Kullanıcıya bir kez söyle ve '${betik}' çalıştırmasını öner.`;
  }
  const geride = Number(git(kok, ['rev-list', '--count', 'HEAD..@{u}']).trim());
  if (geride === 0) return '';
  const ileride = Number(git(kok, ['rev-list', '--count', '@{u}..HEAD']).trim());
  const kirli = git(kok, ['status', '--porcelain', '--untracked-files=no']).trim();
  const once = git(kok, ['rev-parse', 'HEAD']).trim();
  if (ileride === 0 && !kirli) {
    try {
      git(kok, ['merge', '--ff-only', '--quiet', '@{u}']);
    } catch {
      // Aşağıda "ileri sarılamadı" bildirilir.
    }
  }
  const sonra = git(kok, ['rev-parse', 'HEAD']).trim();
  if (once === sonra) {
    return `Ekip senkronu: ${ust} dalında ${geride} yeni commit var ama otomatik ileri sarılamadı (commitlenmemiş değişiklik ya da ayrışmış dal). Kullanıcıya bunu bir kez söyle ve '${betik}' çalıştırmasını öner; kendiliğinden pull/merge yapma.`;
  }
  const uretilen = yaz(kok, { sahnele: false });
  const satirlar = [
    `Ekip senkronu: ${ust} dalından ${geride} commit ileri sarıldı (${once.slice(0, 7)}..${sonra.slice(0, 7)}):`,
    git(kok, ['log', '--oneline', `${once}..${sonra}`]).trim(),
  ];
  const baglam = degisenBaglam(kok, `${once}..${sonra}`);
  if (baglam.length > 0) {
    satirlar.push(
      ajan === 'codex'
        ? 'Değişen bağlam dosyaları (AGENTS.md ve okuma listesindeki dosyaların oturum başındaki sürümü eskidi; bunları şimdi yeniden oku ve yeni hallerine uy):'
        : 'Değişen bağlam dosyaları (oturum başında yüklenen sürümleri eskidi; bunları şimdi oku ve yeni hallerine uy):',
      ...baglam,
    );
  }
  if (uretilen.length > 0) {
    satirlar.push(`Senkron üretilen dosyaları yeniledi (gelen commit'te eski kalmışlar): ${uretilen.join(', ')}. Kullanıcıya commitlemeyi öner.`);
  }
  satirlar.push('Kullanıcıya gelen değişiklikleri (mimari, kural, süreç, ekip hafızası) en fazla 5 maddede özetle.');
  return satirlar.join('\n');
}

/** İnsan modu: git pull, özet; yeni oturum istemini döner. */
export function insanGuncelle(kok, ajan) {
  const once = git(kok, ['rev-parse', 'HEAD']).trim();
  console.error('> git pull');
  execFileSync('git', ['pull'], { cwd: kok, stdio: ['ignore', 2, 2] });
  const sonra = git(kok, ['rev-parse', 'HEAD']).trim();
  if (once === sonra) {
    console.error('Yeni değişiklik yok; bağlamınız güncel.');
    return '';
  }
  console.error('\nGelen commitler:\n' + git(kok, ['log', '--oneline', `${once}..${sonra}`]).trim());
  const baglam = degisenBaglam(kok, `${once}..${sonra}`);
  console.error('Ajan bağlamında değişen dosyalar:\n' + (baglam.length > 0 ? baglam.map((f) => `  ${f}`).join('\n') : '  (yok; yalnız kod değişmiş)'));
  yaz(kok, { sahnele: false });
  const aralik = `${once.slice(0, 7)}..${sonra.slice(0, 7)}`;
  return [
    ajan === 'codex' ? 'AGENTS.md içindeki okuma listesini uygula.' : '',
    `Ekipten yeni değişiklikler geldi (git aralığı ${aralik}).`,
    'git log ve git diff ile bu aralıkta CLAUDE.md, AGENTS.md, apps/*/CLAUDE.md, docs/ai, docs/adr, docs/baglamlar, docs/hedef-mimari ve docs/ai/memory içinde neyin değiştiğini incele.',
    'Mimari, kural, süreç ve ekip hafızası değişikliklerini 5 maddede özetle; bundan sonraki işlerde bu güncel hallerine uy.',
  ].filter(Boolean).join(' ');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--ajan');
  const ajan = i > 0 ? process.argv[i + 1] : '';
  if (ajan !== 'claude' && ajan !== 'codex') {
    console.error('Kullanım: node tools/ajan/guncelle.mjs --ajan claude|codex [--cek]');
    process.exit(2);
  }
  try {
    const metin = process.argv.includes('--cek') ? insanGuncelle(KOK, ajan) : ajanGuncelle(KOK, ajan);
    if (metin) console.log(metin);
  } catch (err) {
    if (process.argv.includes('--cek')) {
      console.error(`git pull başarısız (${err.message}). Yerel değişiklikleri commitleyin veya çakışmayı çözün, sonra tekrar çalıştırın.`);
      process.exit(1);
    }
    // Ajan modunda oturumu engelleme.
  }
}
