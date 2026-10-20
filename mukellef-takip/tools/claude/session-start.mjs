#!/usr/bin/env node
// Claude Code SessionStart kancası — ekip hafızasını (docs/ai/memory) geliştiriciden bağımsız kılar.
//   1) Oturumun .claude/settings.local.json dosyasına autoMemoryDirectory = docs/ai/memory (mutlak yol) yazar.
//      Claude Code bu ayarı paylaşılan settings.json'dan güvenlik gereği okumaz; yerel ayar her makinede bu kancayla oluşur.
//   2) Ayar bu oturumda yeni yazıldıysa MEMORY.md'yi bağlama ekler (sonraki oturumlardan itibaren Claude Code kendisi yükler).
//   3) Kişisel (eski) hafızada kayıt varsa ve son 14 günde ekip hafızası değiştiyse kısa not düşer.
// Yalnız Node yerleşik modülleri; hata olursa oturumu engellemez (çıkış kodu hep 0).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const memoryDir = join(projectRoot, 'docs', 'ai', 'memory');

const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const samePath = (a, b) => {
  const norm = (p) => resolve(p.replace(/^~(?=[\\/]|$)/, homedir())).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

const notes = [];
const input = readStdin();
const sessionDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

// 1) Yerel ayar
let justConfigured = false;
const localPath = join(sessionDir, '.claude', 'settings.local.json');
try {
  let settings = {};
  if (existsSync(localPath)) settings = JSON.parse(readFileSync(localPath, 'utf8'));
  const current = settings.autoMemoryDirectory;
  if (current === undefined) {
    settings.autoMemoryDirectory = memoryDir;
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, JSON.stringify(settings, null, 2) + '\n');
    justConfigured = true;
  } else if (!samePath(current, memoryDir)) {
    notes.push(
      `Uyarı: ${localPath} içinde autoMemoryDirectory başka bir dizini gösteriyor (${current}). ` +
        `Ekip hafızası ${memoryDir}; kullanıcıya bunu değiştirmek isteyip istemediğini sor, kendiliğinden değiştirme.`,
    );
  }
} catch (err) {
  notes.push(`Uyarı: ${localPath} okunamadı/yazılamadı (${err.message}); ekip hafızası otomatik etkinleşmedi.`);
}

if (justConfigured) {
  notes.push(
    `Ekip hafızası bu makinede etkinleştirildi: autoMemoryDirectory → ${memoryDir} (${localPath}). ` +
      'Yeni hafıza kayıtları bu dizine yazılır ve git ile paylaşılır; kişisel veri, sır ve kişiye özel tercih yazma.',
  );
  try {
    notes.push('Ekip hafızası dizini (MEMORY.md):\n' + readFileSync(join(memoryDir, 'MEMORY.md'), 'utf8'));
  } catch {
    // Dizin henüz yoksa Claude ilk kayıtta oluşturur.
  }
}

// 2) Kişisel hafızada kalmış kayıtlar (Claude Code varsayılanı: ~/.claude/projects/<cwd'nin sadeleştirilmiş adı>/memory)
try {
  const projectsDir = join(homedir(), '.claude', 'projects');
  const key = resolve(sessionDir).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const match = readdirSync(projectsDir).find((d) => d.toLowerCase() === key);
  if (match) {
    const personal = join(projectsDir, match, 'memory');
    const files = existsSync(personal) ? readdirSync(personal).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md') : [];
    if (files.length > 0) {
      notes.push(
        `Kişisel hafızada bu projeye ait ${files.length} kayıt var (${personal}). ` +
          'Uygun olanlar `/hafiza aktar` ile ekip hafızasına taşınabilir; kullanıcıya bir kez öner.',
      );
    }
  }
} catch {
  // ~/.claude/projects yoksa yapılacak bir şey yok.
}

// 3) Ekip hafızasındaki son değişiklikler (başkalarının öğrendikleri)
try {
  const log = execFileSync(
    'git',
    ['log', '--since=14.days', '-n', '5', '--date=short', '--format=%h %ad %an: %s', '--', 'docs/ai/memory'],
    { cwd: projectRoot, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] },
  ).trim();
  if (log) notes.push('Ekip hafızasında son 14 günün değişiklikleri:\n' + log);
} catch {
  // git yoksa geç.
}

if (notes.length > 0) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notes.join('\n\n') } }),
  );
}
process.exit(0);
