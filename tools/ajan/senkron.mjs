#!/usr/bin/env node
// Claude ↔ Codex bağlam senkronu (D31, docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md).
// Tek kaynak elle yazılır: CLAUDE.md (kök + alt dizinler), docs/ai/*.md, docs/ai/memory/*.md, docs/ai/beceriler/*.md.
// Araca özel yansımalar bundan ÜRETİLİR (elle düzenlenmez):
//   • AGENTS.md (kök): okuma listesi, ekip hafızası, beceri eşlemesi, akış — Codex her oturumda yükler (Claude → Codex)
//   • <dizin>/AGENTS.md: her alt dizin CLAUDE.md'si için "bu dizinde CLAUDE.md'yi oku" + başlık özeti
//   • docs/ai/memory/MEMORY.md: dizinde satırı olmayan kayıt eklenir, silinen kaydın satırı kaldırılır (Codex → Claude)
//   • .claude/skills/<ad>/SKILL.md: docs/ai/beceriler/<ad>.md'den (Codex → Claude)
//
// Kullanım (depo kökünden):
//   node tools/ajan/senkron.mjs --yaz [--sahneleme-yok] [--sessiz]   üretir; değiştiyse git add ile sahneler
//   node tools/ajan/senkron.mjs --denetle                              yazmaz; uyumsuzlukta 1 ile çıkar (CI, pre-push)
//   node tools/ajan/senkron.mjs --kanca-kur                            core.hooksPath + autoMemoryDirectory (pnpm prepare)
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, gitDeposuMu, hafizaAyariniKur, kancalariKur, KOK, onBilgi } from './ortak.mjs';

export const URETILDI = '<!-- senkron:uretildi — elle düzenlemeyin; kaynak ve üretici: node tools/ajan/senkron.mjs --yaz -->';
const BLOK = (ad, govde) => `<!-- senkron:baslangic ${ad} -->\n${govde.trim()}\n<!-- senkron:bitis ${ad} -->`;
const HARIC = /^(eski|docs\/arsiv|node_modules)\/|\/node_modules\//;

const oku = (kok, yol) => readFileSync(join(kok, yol), 'utf8').replace(/\r\n/g, '\n');
const varMi = (kok, yol) => existsSync(join(kok, yol));

function dosyalar(kok, desen) {
  if (gitDeposuMu(kok)) {
    return git(kok, ['ls-files', '-co', '--exclude-standard', '--', desen]).split('\n').filter((f) => f && varMi(kok, f));
  }
  const out = [];
  const ad = basename(desen);
  const gez = (d) => {
    for (const e of readdirSync(join(kok, d))) {
      if (e === '.git' || e === 'node_modules') continue;
      const p = d ? `${d}/${e}` : e;
      if (statSync(join(kok, p)).isDirectory()) gez(p);
      else if (e === ad) out.push(p);
    }
  };
  gez('');
  return out;
}

/** Kaynakları okur. */
export function kaynaklar(kok) {
  const claude = varMi(kok, 'CLAUDE.md') ? oku(kok, 'CLAUDE.md') : '';
  const iceAktarimlar = [...claude.matchAll(/^\s*-\s*@([\w./-]+\.md)\s*(?:—\s*(.*))?$/gm)].map((m) => ({ yol: m[1], aciklama: m[2]?.trim() ?? '' }));
  const altClaude = dosyalar(kok, '**/CLAUDE.md').filter((f) => f !== 'CLAUDE.md' && f.endsWith('/CLAUDE.md') && !HARIC.test(f)).sort();
  const hafizaDizini = 'docs/ai/memory';
  const kayitlar = varMi(kok, hafizaDizini)
    ? readdirSync(join(kok, hafizaDizini)).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').sort()
        .map((f) => ({ dosya: f, on: onBilgi(oku(kok, `${hafizaDizini}/${f}`)) ?? {} }))
    : [];
  const beceriDizini = 'docs/ai/beceriler';
  const beceriler = varMi(kok, beceriDizini)
    ? readdirSync(join(kok, beceriDizini)).filter((f) => f.endsWith('.md') && f !== 'README.md').sort()
        .map((f) => ({ ad: basename(f, '.md'), metin: oku(kok, `${beceriDizini}/${f}`) }))
        .map((b) => ({ ...b, on: onBilgi(b.metin) ?? {} }))
    : [];
  return { iceAktarimlar, altClaude, kayitlar, beceriler };
}

/** MEMORY.md: var olan satırlar korunur, dosyası olmayan satır silinir, satırı olmayan kayıt description'dan eklenir. */
export function hafizaDizini(mevcut, kayitlar) {
  const dosyaAdlari = new Set(kayitlar.map((k) => k.dosya));
  const satirlar = mevcut.replace(/\r\n/g, '\n').split('\n');
  const tutulan = satirlar.filter((s) => {
    const m = s.match(/\]\(([^)]+\.md)\)/);
    return !m || dosyaAdlari.has(m[1]);
  });
  const listelenen = new Set(tutulan.map((s) => s.match(/\]\(([^)]+\.md)\)/)?.[1]).filter(Boolean));
  while (tutulan.length > 0 && tutulan.at(-1) === '') tutulan.pop();
  for (const k of kayitlar) {
    if (!listelenen.has(k.dosya)) tutulan.push(`- [${k.on.name ?? basename(k.dosya, '.md')}](${k.dosya}) — ${k.on.description ?? ''}`.trimEnd());
  }
  return tutulan.join('\n') + '\n';
}

function basliklar(metin) {
  const h = [...metin.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  if (h.length > 0) return h.map((x) => `- ${x}`);
  return metin.split('\n').filter((s) => /^- /.test(s)).slice(0, 10);
}

function altAgents(kok, claudeYolu) {
  const dizin = posix.dirname(claudeYolu);
  const metin = oku(kok, claudeYolu);
  const baslik = metin.match(/^#\s+(.+)$/m)?.[1] ?? dizin;
  const kokeGore = posix.relative(dizin, '') || '.';
  return [
    URETILDI,
    `# ${baslik} — kodlama ajanı talimatları`,
    '',
    `Bu dizinde çalışırken önce bu dizindeki \`CLAUDE.md\`'yi oku; kurallar oradadır ve senin için de bağlayıcıdır. Kök talimatlar: [${kokeGore}/AGENTS.md](${kokeGore}/AGENTS.md).`,
    '',
    '`CLAUDE.md` içeriği:',
    '',
    ...basliklar(metin),
    '',
  ].join('\n');
}

function kokAgents(k, hafiza) {
  const okuma = [
    '## Okuma listesi (oturum başında, kod yazmadan önce)',
    '',
    '1. `CLAUDE.md` — proje belleği ve **pazarlıksız kurallar** (senin için de bağlayıcıdır). İçindeki `@yol` satırları içe aktarımdır; şunları da sırayla oku:',
    ...k.iceAktarimlar.map((i) => `   - \`${i.yol}\`${i.aciklama ? ` — ${i.aciklama}` : ''}`),
    '2. Çalıştığın dizinin bağlamı (o dizindeki `AGENTS.md` aynı dosyayı gösterir):',
    ...(k.altClaude.length > 0 ? k.altClaude.map((c) => `   - \`${c}\``) : ['   - (yok)']),
    '3. Bir bağlamda çalışacaksan `docs/baglamlar/<context>.md`; karar ve gerekçe için `docs/adr/karar-kaydi.md` ve `docs/hedef-mimari/`.',
  ].join('\n');
  const hafizaBlok = [
    '## Ekip hafızası (`docs/ai/memory/`)',
    '',
    'Claude Code bu dizine otomatik yazar; sende otomatik hafıza yok, aynı biçimi elle uygula:',
    '',
    '- Tek bilgi = tek dosya `docs/ai/memory/<kebab-ad>.md`; ön bilgi `name` (= dosya adı), `description` (tek satır), `metadata.type` (`feedback` | `project` | `reference`). `feedback`/`project` gövdesinde **Why:** ve **How to apply:** satırları; ilgili kayıtlara `[[ad]]`.',
    '- Önce benzer kayıt var mı bak; varsa güncelle. Göreli tarihi mutlak yaz. `MEMORY.md` satırını unutursan senkron ekler.',
    '- Kişiye özel tercih (`~/.codex/AGENTS.md`\'ye), kişisel veri ve sır hiçbir yere yazılmaz. Sonra `node tools/claude/check-memory.mjs`.',
    '- Son değişiklikler: `git log --since=14.days --date=short --format="%h %ad %an: %s" -- docs/ai/memory`',
    '',
    'Güncel dizin (`MEMORY.md`):',
    '',
    hafiza.trim().replace(/\]\(([\w.-]+\.md)\)/g, '](docs/ai/memory/$1)'),
  ].join('\n');
  const beceri = [
    '## Beceriler',
    '',
    'İstek aşağıdakilerden birine uyuyorsa ilgili dosyayı oku ve adımlarını uygula (Claude\'a özgü araç adlarını kendi araçlarınla karşıla):',
    '',
    ...(k.beceriler.length > 0
      ? k.beceriler.map((b) => `- **${b.on.name ?? b.ad}** → \`docs/ai/beceriler/${b.ad}.md\` — ${b.on.description ?? ''}`.trimEnd())
      : ['- (yok)']),
  ].join('\n');
  const akis = [
    '## Akış (zorunlu)',
    '',
    '- **Oturum başında**, kullanıcı başka bir şey istese de önce: `node tools/ajan/guncelle.mjs --ajan codex` — çıktısı varsa (ekipten gelen değişiklik, değişen bağlam dosyaları) ona uy. Ağ izni yoksa çıktı bunu söyler.',
    '- **İşi bitirmeden ve commitlemeden önce**: `node tools/ajan/bitir.mjs --ajan codex` — çıktısındaki adımların hepsini uygula (kaynak belgeler, hafıza, senkron, bağımsız inceleme, testler, iş dalında commit, PR taslağı).',
    '- Kural, mimari veya durum değişikliği bu dosyaya **yazılmaz**: `CLAUDE.md`, `docs/ai/*.md`, `docs/adr/karar-kaydi.md` veya ilgili `docs/baglamlar/` sayfasına yazılır. Bu dosyaya elle eklenen içerik `senkron --denetle`\'de (pre-push, CI) hata verir.',
  ].join('\n');
  return [
    URETILDI,
    '# Eworks — kodlama ajanı talimatları (Codex vb.)',
    '',
    'Bu dosya **üretilir**; kural burada yazılmaz ve tekrarlanmaz. Kaynaklar: `CLAUDE.md` (kök ve alt dizinler), `docs/ai/`, `docs/ai/memory/`, `docs/ai/beceriler/`. Claude Code kullanan ekip üyeleriyle **aynı bağlamı** kullanırsın; çelişki olursa kaynak dosya geçerlidir. Senkron: [docs/hedef-mimari/09](docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md).',
    '',
    BLOK('okuma-listesi', okuma),
    '',
    BLOK('hafiza', hafizaBlok),
    '',
    BLOK('beceriler', beceri),
    '',
    BLOK('akis', akis),
    '',
  ].join('\n');
}

function skill(b) {
  const m = b.metin.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (!m) return `${URETILDI}\n${b.metin}`;
  return `${m[1]}\n${URETILDI.replace(' -->', `; kaynak docs/ai/beceriler/${b.ad}.md -->`)}\n${m[2].replace(/^\n/, '')}`;
}

/** Üretilmesi gereken tüm dosyalar: yol → içerik. */
export function uret(kok) {
  const k = kaynaklar(kok);
  const hafiza = hafizaDizini(varMi(kok, 'docs/ai/memory/MEMORY.md') ? oku(kok, 'docs/ai/memory/MEMORY.md') : '', k.kayitlar);
  const out = { 'AGENTS.md': kokAgents(k, hafiza) };
  if (varMi(kok, 'docs/ai/memory')) out['docs/ai/memory/MEMORY.md'] = hafiza;
  for (const c of k.altClaude) out[`${posix.dirname(c)}/AGENTS.md`] = altAgents(kok, c);
  for (const b of k.beceriler) out[`.claude/skills/${b.ad}/SKILL.md`] = skill(b);
  return out;
}

/** Kaynağı kalmamış üretilmiş dosyalar (silinecekler). */
export function artiklar(kok, beklenen) {
  const adaylar = [
    ...dosyalar(kok, '**/AGENTS.md').filter((f) => !HARIC.test(f)),
    ...dosyalar(kok, '.claude/skills/**/SKILL.md'),
  ];
  return [...new Set(adaylar)].filter((f) => !(f in beklenen) && oku(kok, f).includes('senkron:uretildi'));
}

const BLOKLAR = /<!-- senkron:baslangic ([\w-]+) -->[\s\S]*?<!-- senkron:bitis \1 -->/g;
const disarisi = (metin) => metin.replace(/\r\n/g, '\n').replace(BLOKLAR, '<!-- blok $1 -->').trim();

/** Uyumsuzlukları açıklayan mesajlar; boşsa her şey güncel. */
export function denetle(kok) {
  const beklenen = uret(kok);
  const sorunlar = [];
  for (const [yol, icerik] of Object.entries(beklenen)) {
    if (!varMi(kok, yol)) {
      sorunlar.push(`${yol} yok — node tools/ajan/senkron.mjs --yaz`);
      continue;
    }
    const mevcut = oku(kok, yol);
    if (mevcut === icerik) continue;
    if (yol.endsWith('AGENTS.md') && disarisi(mevcut) !== disarisi(icerik)) {
      sorunlar.push(`${yol}: üretilen blokların dışına elle içerik eklenmiş ya da değiştirilmiş. Kuralı CLAUDE.md veya docs/ai'ye taşı, sonra --yaz`);
    } else {
      sorunlar.push(`${yol}: kaynakla uyumsuz (üretilenler eski) — node tools/ajan/senkron.mjs --yaz`);
    }
  }
  for (const a of artiklar(kok, beklenen)) sorunlar.push(`${a}: kaynağı kalmamış üretilmiş dosya — --yaz siler`);
  return sorunlar;
}

/** Üretir ve yazar; değişen yolları döner. */
export function yaz(kok, { sahnele = true } = {}) {
  const beklenen = uret(kok);
  const degisen = [];
  for (const [yol, icerik] of Object.entries(beklenen)) {
    if (varMi(kok, yol) && oku(kok, yol) === icerik) continue;
    mkdirSync(dirname(join(kok, yol)), { recursive: true });
    writeFileSync(join(kok, yol), icerik);
    degisen.push(yol);
  }
  for (const a of artiklar(kok, beklenen)) {
    rmSync(join(kok, a));
    degisen.push(a);
  }
  if (sahnele && degisen.length > 0 && gitDeposuMu(kok)) git(kok, ['add', '-A', '--', ...degisen]);
  return degisen;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--kanca-kur')) {
    const k = kancalariKur(KOK);
    if (k === 'kuruldu') console.log(`✔ git kancaları: core.hooksPath = tools/git-hooks`);
    if (typeof k === 'object') console.warn(`⚠ core.hooksPath başka bir dizini gösteriyor (${k.farkli}); tools/git-hooks kurulmadı`);
    if (!process.env.CI && k !== 'git-yok') {
      const h = hafizaAyariniKur(KOK);
      if (h === 'eklendi' || h === 'duzeltildi') console.log(`✔ Claude Code ekip hafızası: autoMemoryDirectory → docs/ai/memory (${h})`);
    }
  } else if (args.has('--denetle')) {
    const s = denetle(KOK);
    for (const x of s) console.error(`✖ ${x}`);
    if (s.length > 0) {
      console.error(`✖ Ajan bağlamı senkron değil (${s.length} sorun)`);
      process.exit(1);
    }
    console.log('✔ Ajan bağlamı senkron (AGENTS.md, MEMORY.md, beceriler)');
  } else if (args.has('--yaz')) {
    const d = yaz(KOK, { sahnele: !args.has('--sahneleme-yok') });
    if (!args.has('--sessiz')) console.log(d.length > 0 ? `✔ Üretilen ajan dosyaları güncellendi: ${d.join(', ')}` : '✔ Ajan dosyaları zaten güncel');
  } else {
    console.error('Kullanım: node tools/ajan/senkron.mjs --yaz [--sahneleme-yok] [--sessiz] | --denetle | --kanca-kur');
    process.exit(2);
  }
}
