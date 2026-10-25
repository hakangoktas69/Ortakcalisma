#!/usr/bin/env node
// Ekip hafızası denetimi (docs/ai/memory) — pnpm verify, pre-commit/pre-push kancaları ve CI'da çalışır.
// Başka bir hafıza dizini için: node tools/claude/check-memory.mjs --dizin eski/hakan/mukellef-takip/docs/ai/memory
//   • her kayıt: ön bilgi (frontmatter) var, name = dosya adı, description dolu, metadata.type ∈ feedback|project|reference
//   • MEMORY.md her kaydı tam bir kez listeler, olmayan dosyaya bağlantı vermez, 200 satırı aşmaz (Claude fazlasını yüklemez)
//   • kişisel veri / sır kalıpları yok: geçerli TCKN, IBAN, e-posta (test alan adları hariç), cep telefonu, anahtar/parola
// Kırık [[bağlantı]] yalnız uyarıdır: henüz yazılmamış bir kaydı işaret edebilir.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const dizinArg = process.argv.indexOf('--dizin');
const memoryDir = dizinArg > 0 ? resolve(projectRoot, process.argv[dizinArg + 1]) : join(projectRoot, 'docs', 'ai', 'memory');
// [[bağlantı]] hedefleri hafızanın bulunduğu docs/ kasasında aranır
const docsDir = resolve(memoryDir, '..', '..');
const TYPES = new Set(['feedback', 'project', 'reference']);
const errors = [];
const warnings = [];

const rel = (p) => relative(projectRoot, p).replaceAll('\\', '/');

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let parent = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\s*)([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, indent, key, value] = kv;
    if (indent.length === 0) {
      parent = value === '' ? key : null;
      out[key] = value === '' ? {} : value;
    } else if (parent) {
      out[parent][key] = value;
    }
  }
  return out;
}

function validTckn(s) {
  const d = [...s].map(Number);
  if (d[0] === 0) return false;
  const d10 = (((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10 + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === d10 && d[10] === d11;
}

const SENSITIVE = [
  ['IBAN', /\bTR\d{2}\s?(?:\d{4}\s?){5}\d{2}\b/],
  ['cep telefonu', /(?<!\d)(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/],
  ['özel anahtar', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['API anahtarı', /\b(?:sk-ant-[\w-]{10,}|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/],
  ['parola/sır ataması', /\b(?:password|parola|şifre|secret|token)\s*[:=]\s*['"]?[^\s'"`]{6,}/i],
];
const ALLOWED_EMAIL = /@(?:eworks\.test|mukellef\.test|example\.(?:com|org)|anthropic\.com)$/i;

function scanSensitive(file, text) {
  for (const [label, re] of SENSITIVE) {
    if (re.test(text)) errors.push(`${rel(file)}: olası ${label} — hafızaya kişisel veri veya sır yazılmaz`);
  }
  for (const m of text.matchAll(/(?<!\d)[1-9]\d{10}(?!\d)/g)) {
    if (validTckn(m[0])) errors.push(`${rel(file)}: geçerli TCKN biçiminde sayı (${m[0].slice(0, 3)}…) — gerçek kişi verisi yazılmaz`);
  }
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) {
    if (!ALLOWED_EMAIL.test(m[0])) errors.push(`${rel(file)}: e-posta adresi (${m[0].replace(/^[^@]+/, '…')}) — kişisel veri yazılmaz`);
  }
}

function docNames(dir, acc = new Set()) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) docNames(p, acc);
    else if (entry.endsWith('.md')) acc.add(basename(entry, '.md'));
  }
  return acc;
}

if (!existsSync(memoryDir)) {
  console.error(`✖ ${rel(memoryDir)} yok`);
  process.exit(1);
}

const files = readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
const linkTargets = docNames(docsDir);

for (const f of files) {
  const file = join(memoryDir, f);
  const text = readFileSync(file, 'utf8');
  const fm = frontmatter(text);
  if (!fm) {
    errors.push(`${rel(file)}: ön bilgi (--- name/description/metadata.type ---) yok`);
  } else {
    if (fm.name !== basename(f, '.md')) errors.push(`${rel(file)}: name (${fm.name ?? '—'}) dosya adıyla aynı olmalı`);
    if (!fm.description) errors.push(`${rel(file)}: description boş`);
    const type = fm.metadata?.type ?? fm.type;
    if (type === 'user') {
      errors.push(`${rel(file)}: 'user' türü kişiye özeldir; CLAUDE.local.md veya ~/.claude/CLAUDE.md'ye taşı`);
    } else if (!TYPES.has(type)) {
      errors.push(`${rel(file)}: metadata.type (${type ?? '—'}) feedback|project|reference olmalı`);
    }
  }
  for (const m of text.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)) {
    if (!linkTargets.has(m[1].trim())) warnings.push(`${rel(file)}: [[${m[1]}]] henüz bir belgeye çözülmüyor`);
  }
  scanSensitive(file, text);
}

const indexFile = join(memoryDir, 'MEMORY.md');
if (!existsSync(indexFile)) {
  errors.push(`${rel(indexFile)} yok`);
} else {
  const index = readFileSync(indexFile, 'utf8');
  const lines = index.split(/\r?\n/);
  if (lines.length > 200) errors.push(`${rel(indexFile)}: ${lines.length} satır; 200'ü aşan kısım Claude'a yüklenmez, kayıtları birleştir`);
  const linked = [...index.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
  for (const f of files) {
    const n = linked.filter((l) => l === f).length;
    if (n === 0) errors.push(`${rel(indexFile)}: ${f} listelenmemiş`);
    if (n > 1) errors.push(`${rel(indexFile)}: ${f} ${n} kez listelenmiş (birleştirme artığı olabilir)`);
  }
  for (const l of new Set(linked)) {
    if (!files.includes(l)) errors.push(`${rel(indexFile)}: ${l} bağlantısı var ama dosya yok`);
  }
  scanSensitive(indexFile, index);
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
if (errors.length > 0) {
  console.error(`✖ Ekip hafızası denetimi başarısız (${errors.length} sorun)`);
  process.exit(1);
}
console.log(`✔ Ekip hafızası denetimi: ${files.length} kayıt`);
