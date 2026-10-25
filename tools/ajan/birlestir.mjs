#!/usr/bin/env node
// Kişisel dalı dev'e birleştirme (D37). İş kişisel dalda (`<ad>/<kısa-iş>`) bitip commitlendikten sonra iki adım:
//
//   node tools/ajan/birlestir.mjs guncelle
//     dev'in güncellemelerini kişisel dala çeker (merge; rebase değil, paylaşılmış geçmiş yeniden yazılmaz).
//     Çatışma varsa dosyaları ve her iki tarafın commitlerini listeler, birleşmeyi çözüm için açık bırakır (çıkış 1).
//     Çatışma dev'de değil kişisel dalda çözülür; birleşik kod yeni koddur, doğrulamalar yeniden koşulur.
//   node tools/ajan/birlestir.mjs dev --mesaj "<Türkçe başlık>\n\n<kısa rapor>"
//     dev'in son halini içeren kişisel dalı dev'e --no-ff birleştirir (çatışmasız olmak zorunda); hassas alan
//     değiştiyse mesaja "Kıdemli onayı gerekli" bölümü eklenir. Push ETMEZ: dev'i göndermek kullanıcı onayıyla.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIRLESIM_DALI, git, hassasAlanlar, KOD_SAHIBI, KOK, ortakDalMi } from './ortak.mjs';

// Elle çözülmez, kaynaktan yeniden üretilir
const URETILEN = [
  [/(^|\/)AGENTS\.md$|^docs\/ai\/memory\/MEMORY\.md$|^\.claude\/skills\/|^\.github\/CODEOWNERS$/, 'node tools/ajan/senkron.mjs --yaz'],
  [/^docs\/ozellik-durumu\.md$|^packages\/feature-registry\/feature-status\.json$/, 'pnpm features'],
  [/^pnpm-lock\.yaml$/, 'package.json çatışmalarını çöz, sonra Node 24 container\'ında pnpm install --lockfile-only'],
  [/(^|\/)uv\.lock$/, 'pyproject.toml çatışmalarını çöz, sonra uv lock'],
];

class Dur extends Error {}
const satirlar = (metin) => metin.split('\n').filter((s) => s.trim() !== '');
const refVar = (kok, ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: kok }).status === 0;
const ataMi = (kok, ata, torun) => spawnSync('git', ['merge-base', '--is-ancestor', ata, torun], { cwd: kok }).status === 0;

/** Dal, temizlik ve birleşim hedefi (dev'in en güncel hali: yerel dev itilmemiş birleşim taşıyorsa o, yoksa origin/dev). */
function hazirlik(kok) {
  let dal = '';
  try {
    dal = git(kok, ['symbolic-ref', '--short', '-q', 'HEAD']).trim();
  } catch {
    throw new Dur('Ayrık HEAD: kişisel dala geç (git switch <ad>/<kısa-iş>).');
  }
  if (ortakDalMi(dal)) throw new Dur(`"${dal}" ortak dal. Kişisel dalda çalış: git switch -c <ad>/<kısa-iş>`);
  if (git(kok, ['status', '--porcelain']).trim() !== '') throw new Dur('Commitlenmemiş değişiklik var: önce kişisel dalda commitle.');
  if (satirlar(git(kok, ['remote'])).includes('origin')) {
    const f = spawnSync('git', ['fetch', '-q', 'origin', BIRLESIM_DALI], { cwd: kok, encoding: 'utf8' });
    if (f.status !== 0) throw new Dur(`origin/${BIRLESIM_DALI} alınamadı: ${f.stderr.trim()}`);
  }
  const uzak = `refs/remotes/origin/${BIRLESIM_DALI}`;
  const yerel = `refs/heads/${BIRLESIM_DALI}`;
  const u = refVar(kok, uzak);
  const y = refVar(kok, yerel);
  let hedef;
  if (u && y) {
    if (ataMi(kok, uzak, yerel)) hedef = yerel;
    else if (ataMi(kok, yerel, uzak)) hedef = uzak;
    else throw new Dur(`Yerel ${BIRLESIM_DALI} ile origin/${BIRLESIM_DALI} ayrışmış (itilmemiş birleşim + yeni uzak commit). Kullanıcıya sor.`);
  } else if (u || y) hedef = u ? uzak : yerel;
  else throw new Dur(`${BIRLESIM_DALI} dalı bulunamadı.`);
  return { dal, hedef, uzak, u, y };
}

function guncelle(kok) {
  const { dal, hedef } = hazirlik(kok);
  const yeni = satirlar(git(kok, ['log', '--format=  %h %an: %s', `HEAD..${hedef}`]));
  if (yeni.length === 0) {
    console.log(`✔ ${dal} zaten ${BIRLESIM_DALI}'in son halini içeriyor. Sıradaki: node tools/ajan/birlestir.mjs dev --mesaj "…"`);
    return 0;
  }
  const r = spawnSync('git', ['merge', '--no-edit', '-m', `${BIRLESIM_DALI} güncellemeleri ${dal} dalına alındı`, hedef], {
    cwd: kok,
    encoding: 'utf8',
  });
  if (r.status === 0) {
    console.log(
      [
        `✔ ${BIRLESIM_DALI}'den ${yeni.length} commit ${dal} dalına çatışmasız alındı:`,
        ...yeni,
        'Birleşik kod yeni koddur: doğrulamaları yeniden koş (gelistir C2–C3: pnpm verify, gerekirse yığın testleri ve e2e).',
        `Yeşilse: node tools/ajan/birlestir.mjs dev --mesaj "<Türkçe başlık>\\n\\n<kısa rapor>"`,
      ].join('\n'),
    );
    return 0;
  }
  const catisan = satirlar(git(kok, ['diff', '--name-only', '--diff-filter=U']));
  if (catisan.length === 0) throw new Dur(`Birleştirme başarısız: ${(r.stderr || r.stdout).trim()}`);
  const cikti = [`✖ ${BIRLESIM_DALI} ${dal} dalına alınırken ${catisan.length} dosyada çatışma var. Birleşme açık; kişisel dalda çöz.`];
  for (const d of catisan) {
    const uretim = URETILEN.find(([desen]) => desen.test(d));
    if (uretim) {
      cikti.push(`• ${d} — üretilen dosya, elle çözme; yeniden üret: ${uretim[1]}`);
      continue;
    }
    const onlar = satirlar(git(kok, ['log', '--format=      %h %an: %s', `HEAD..MERGE_HEAD`, '--', d]));
    const biz = satirlar(git(kok, ['log', '--format=      %h %an: %s', `MERGE_HEAD..HEAD`, '--', d]));
    cikti.push(`• ${d}`, `    ${BIRLESIM_DALI} tarafı:`, ...onlar, `    ${dal} tarafı:`, ...biz);
  }
  cikti.push(
    'Çözüm (gelistir C6): her iki tarafın amacını commit mesajından, testlerinden ve özellik anahtarından çıkar; iki amacı da',
    'koruyan kodu yaz, öteki tarafın testini silme ya da zayıflatma. Amaçlar çelişiyorsa, öteki tarafın amacı belirsizse ya da',
    'dosya hassas alandaysa dur ve kullanıcıya sor. Çözünce: git add <dosya> … && git commit --no-edit, sonra doğrulamaları',
    'yeniden koş. Vazgeçmek için: git merge --abort',
  );
  console.log(cikti.join('\n'));
  return 1;
}

function dev(kok, mesaj) {
  if (!mesaj?.trim()) throw new Dur('--mesaj gerekli: Türkçe başlık, boş satır, kısa rapor (ne değişti, doğrulama, koşulamayan).');
  const { dal, hedef, uzak, u, y } = hazirlik(kok);
  if (!ataMi(kok, hedef, 'HEAD')) {
    throw new Dur(`${BIRLESIM_DALI}'in son hali ${dal} dalında yok. Önce: node tools/ajan/birlestir.mjs guncelle (çatışma kişisel dalda çözülür).`);
  }
  const hassas = hassasAlanlar(satirlar(git(kok, ['-c', 'core.quotepath=false', 'diff', '--name-only', `${hedef}...HEAD`])));
  const tam =
    hassas.length > 0
      ? `${mesaj.trimEnd()}\n\nKıdemli onayı gerekli (${KOD_SAHIBI}):\n${hassas.map((h) => `- ${h.neden}: ${h.dosyalar.join(', ')}`).join('\n')}`
      : mesaj.trimEnd();
  if (y) {
    git(kok, ['switch', '-q', BIRLESIM_DALI]);
    if (u && hedef === uzak) git(kok, ['merge', '-q', '--ff-only', uzak]);
  } else {
    git(kok, ['switch', '-q', '-c', BIRLESIM_DALI, '--track', `origin/${BIRLESIM_DALI}`]);
  }
  const r = spawnSync('git', ['merge', '--no-ff', '-q', '-m', tam, dal], { cwd: kok, encoding: 'utf8' });
  if (r.status !== 0) {
    spawnSync('git', ['merge', '--abort'], { cwd: kok });
    git(kok, ['switch', '-q', dal]);
    throw new Dur(`${BIRLESIM_DALI}'e birleştirme başarısız, geri alındı: ${(r.stderr || r.stdout).trim()}`);
  }
  const sha = git(kok, ['rev-parse', '--short', 'HEAD']).trim();
  git(kok, ['switch', '-q', dal]);
  console.log(
    [
      `✔ ${dal} → ${BIRLESIM_DALI} yerelde birleşti (${sha}). Push edilmedi.`,
      hassas.length > 0 ? `  Hassas alan değişti; mesajda "Kıdemli onayı gerekli (${KOD_SAHIBI})" bölümü var.` : '',
      `  Kullanıcı onaylarsa: git push origin ${BIRLESIM_DALI}`,
      `  Sıradaki iş için: git switch -c <ad>/<kısa-iş> ${BIRLESIM_DALI}`,
    ]
      .filter(Boolean)
      .join('\n'),
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [komut] = process.argv.slice(2);
  const i = process.argv.indexOf('--mesaj');
  try {
    if (komut === 'guncelle') process.exit(guncelle(KOK));
    if (komut === 'dev') process.exit(dev(KOK, i > 0 ? process.argv[i + 1] : ''));
    console.error('Kullanım: node tools/ajan/birlestir.mjs guncelle | dev --mesaj "<başlık>\\n\\n<rapor>"');
    process.exit(2);
  } catch (e) {
    if (!(e instanceof Dur)) throw e;
    console.error(`✖ ${e.message}`);
    process.exit(1);
  }
}
