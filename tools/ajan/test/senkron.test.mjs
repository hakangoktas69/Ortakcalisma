// Kabul testleri — Claude ↔ Codex senkronu (docs/hedef-mimari/09-yapay-zeka-ajan-baglami.md §7.6).
// Her test geçici bir git deposunda, deponun tools/ betiklerinin kopyasıyla çalışır.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hafizaAyariniKur } from '../ortak.mjs';
import { denetle, yaz } from '../senkron.mjs';

const GERCEK_KOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const yazDosya = (kok, yol, icerik) => {
  mkdirSync(dirname(join(kok, yol)), { recursive: true });
  writeFileSync(join(kok, yol), icerik);
};
const g = (kok, ...args) => execFileSync('git', args, { cwd: kok, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const KAYIT = (ad, aciklama) => `---\nname: ${ad}\ndescription: ${aciklama}\nmetadata:\n  type: project\n---\n\nBilgi.\n\n**Why:** test.\n**How to apply:** test.\n`;

function depoKur() {
  const kok = mkdtempSync(join(tmpdir(), 'senkron-'));
  g(kok, 'init', '-q', '-b', 'main');
  g(kok, 'config', 'user.name', 'Test');
  g(kok, 'config', 'user.email', 'test@eworks.test');
  g(kok, 'config', 'core.autocrlf', 'false');
  for (const d of ['tools/ajan', 'tools/claude', 'tools/git-hooks']) {
    cpSync(join(GERCEK_KOK, d), join(kok, d), { recursive: true });
  }
  rmSync(join(kok, 'tools/ajan/test'), { recursive: true, force: true });
  yazDosya(kok, 'CLAUDE.md', '# Proje\n\n## Ayrıntılı bağlam\n\n- @docs/ai/vizyon.md — ürün\n');
  yazDosya(kok, 'docs/ai/vizyon.md', '# Vizyon\n');
  yazDosya(kok, 'apps/web/CLAUDE.md', '# apps/web — portal\n\n## Kurallar\n\n- kural\n');
  yazDosya(kok, 'docs/ai/memory/bir-kayit.md', KAYIT('bir-kayit', 'birinci kayıt'));
  yazDosya(kok, 'docs/ai/memory/MEMORY.md', '- [Bir kayıt](bir-kayit.md) — birinci kayıt\n');
  yazDosya(kok, 'docs/ai/beceriler/hafiza.md', '---\nname: hafiza\ndescription: hafızaya yazar\n---\n\n# Ekip hafızası\n');
  yaz(kok, { sahnele: false });
  g(kok, 'add', '-A');
  g(kok, 'commit', '-q', '-m', 'ilk');
  return kok;
}

test('Claude tarafında yeni @docs/ai/x.md eklenince AGENTS.md güncellenir', () => {
  const kok = depoKur();
  assert.deepEqual(denetle(kok), []);
  yazDosya(kok, 'docs/ai/yeni.md', '# Yeni\n');
  yazDosya(kok, 'CLAUDE.md', readFileSync(join(kok, 'CLAUDE.md'), 'utf8') + '- @docs/ai/yeni.md — yeni kural\n');
  assert.ok(denetle(kok).some((s) => s.startsWith('AGENTS.md: kaynakla uyumsuz')), 'denetle eskiyi yakalar');
  const degisen = yaz(kok);
  assert.ok(degisen.includes('AGENTS.md'));
  assert.match(readFileSync(join(kok, 'AGENTS.md'), 'utf8'), /`docs\/ai\/yeni\.md` — yeni kural/);
  assert.match(g(kok, 'diff', '--cached', '--name-only'), /AGENTS\.md/, '--yaz sahneler');
  assert.deepEqual(denetle(kok), []);
});

test("Codex'in dizine eklemediği hafıza kaydı MEMORY.md'ye ve AGENTS.md'ye eklenir; silinen kaydın satırı kalkar", () => {
  const kok = depoKur();
  yazDosya(kok, 'docs/ai/memory/codex-kaydi.md', KAYIT('codex-kaydi', 'Codex yazdı'));
  yaz(kok);
  const dizin = readFileSync(join(kok, 'docs/ai/memory/MEMORY.md'), 'utf8');
  assert.match(dizin, /^- \[codex-kaydi\]\(codex-kaydi\.md\) — Codex yazdı$/m);
  assert.match(dizin, /^- \[Bir kayıt\]\(bir-kayit\.md\) — birinci kayıt$/m, 'elle yazılmış satır korunur');
  assert.match(readFileSync(join(kok, 'AGENTS.md'), 'utf8'), /\]\(docs\/ai\/memory\/codex-kaydi\.md\)/, 'Codex bağlamına da geçer');
  rmSync(join(kok, 'docs/ai/memory/bir-kayit.md'));
  yaz(kok);
  assert.doesNotMatch(readFileSync(join(kok, 'docs/ai/memory/MEMORY.md'), 'utf8'), /bir-kayit/);
});

test("AGENTS.md'ye elle yazılan kural --denetle'de yakalanır", () => {
  const kok = depoKur();
  writeFileSync(join(kok, 'AGENTS.md'), readFileSync(join(kok, 'AGENTS.md'), 'utf8') + '\n## Yeni kural\n\nHer zaman X yap.\n');
  const s = denetle(kok);
  assert.equal(s.length, 1);
  assert.match(s[0], /blokların dışına elle içerik.*CLAUDE\.md veya docs\/ai/);
  const r = spawnSync(process.execPath, [join(kok, 'tools/ajan/senkron.mjs'), '--denetle'], { cwd: kok, encoding: 'utf8' });
  assert.equal(r.status, 1);
});

test('pull sonrası post-merge kancası senkronu çalıştırır ve bağlam değişikliğini uyarır', () => {
  const a = depoKur();
  const b = mkdtempSync(join(tmpdir(), 'senkron-klon-'));
  g(b, '-c', 'core.autocrlf=false', 'clone', '-q', '-c', 'core.autocrlf=false', a, '.');
  const kur = spawnSync(process.execPath, [join(b, 'tools/ajan/senkron.mjs'), '--kanca-kur'], { cwd: b, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  assert.equal(kur.status, 0, kur.stderr);
  assert.equal(g(b, 'config', 'core.hooksPath').trim(), 'tools/git-hooks');

  yazDosya(a, 'docs/ai/vizyon.md', '# Vizyon\n\nDeğişti.\n');
  yazDosya(a, 'docs/ai/memory/ikinci.md', KAYIT('ikinci', 'ikinci kayıt'));
  g(a, 'add', '-A'); // MEMORY.md satırı ve AGENTS.md bilerek güncellenmedi (kancasız commit)
  g(a, 'commit', '-q', '-m', 'bağlam değişti');

  const pull = spawnSync('git', ['pull', '-q'], { cwd: b, encoding: 'utf8' });
  assert.equal(pull.status, 0, pull.stderr);
  assert.match(pull.stderr, /Ajan bağlamı değişti/);
  assert.match(pull.stderr, /docs\/ai\/vizyon\.md/);
  assert.match(readFileSync(join(b, 'docs/ai/memory/MEMORY.md'), 'utf8'), /ikinci\.md/, 'senkron eksik satırı tamamladı');
  assert.equal(g(b, 'diff', '--cached', '--name-only').trim(), '', 'post-merge sahnelemez');
});

test('alt dizin CLAUDE.md silinince üretilmiş AGENTS.md de silinir; beceriler üretilir', () => {
  const kok = depoKur();
  const skill = readFileSync(join(kok, '.claude/skills/hafiza/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: hafiza\n/);
  assert.match(skill, /senkron:uretildi/);
  assert.ok(existsSync(join(kok, 'apps/web/AGENTS.md')));
  rmSync(join(kok, 'apps/web/CLAUDE.md'));
  assert.ok(denetle(kok).some((s) => s.includes('apps/web/AGENTS.md')));
  yaz(kok);
  assert.ok(!existsSync(join(kok, 'apps/web/AGENTS.md')));
});

test('autoMemoryDirectory: yoksa eklenir, eski yol düzeltilir, başka değere dokunulmaz', () => {
  const kok = mkdtempSync(join(tmpdir(), 'hafiza-ayar-'));
  assert.equal(hafizaAyariniKur(kok), 'eklendi');
  const yol = join(kok, '.claude/settings.local.json');
  writeFileSync(yol, JSON.stringify({ autoMemoryDirectory: 'C:\\x\\Ortakcalisma\\mukellef-takip\\docs\\ai\\memory', izin: 1 }));
  assert.equal(hafizaAyariniKur(kok), 'duzeltildi');
  const ayar = JSON.parse(readFileSync(yol, 'utf8'));
  assert.equal(ayar.autoMemoryDirectory, join(kok, 'docs', 'ai', 'memory'));
  assert.equal(ayar.izin, 1);
  assert.equal(hafizaAyariniKur(kok), 'ayni');
  writeFileSync(yol, JSON.stringify({ autoMemoryDirectory: '/baska/yer' }));
  assert.deepEqual(hafizaAyariniKur(kok), { farkli: '/baska/yer' });
});
