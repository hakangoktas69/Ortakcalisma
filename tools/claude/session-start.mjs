#!/usr/bin/env node
// Claude Code SessionStart kancası — ekip hafızasını (docs/ai/memory) geliştiriciden bağımsız kılar.
//   1) Oturumun .claude/settings.local.json dosyasına autoMemoryDirectory = docs/ai/memory (mutlak yol) yazar.
//      Claude Code bu ayarı paylaşılan settings.json'dan güvenlik gereği okumaz; yerel ayar her makinede bu kancayla oluşur.
//      Değer yeniden yapılanma öncesi yol (mukellef-takip/docs/ai/memory) ise kendiliğinden düzeltir; başka bir değerse yalnız uyarır.
//   2) Ayar bu oturumda yazıldıysa MEMORY.md'yi bağlama ekler (sonraki oturumlardan itibaren Claude Code kendisi yükler).
//   3) Kişisel (eski) hafızada kayıt varsa not düşer.
//   4) Ekipten gelen değişiklikleri tools/ajan/guncelle.mjs --ajan claude ile çeker (yalnız güvenli ileri sarma) ve senkronu çalıştırır.
//   5) Son 14 günde ekip hafızası değiştiyse özetler.
// Yalnız Node yerleşik modülleri; hata olursa oturumu engellemez (çıkış kodu hep 0).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { git, hafizaAyariniKur, KOK } from '../ajan/ortak.mjs';

const memoryDir = join(KOK, 'docs', 'ai', 'memory');

const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const notes = [];
const input = readStdin();
const sessionDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const localPath = join(sessionDir, '.claude', 'settings.local.json');

// 1) Yerel ayar
let justConfigured = false;
try {
  const sonuc = hafizaAyariniKur(KOK, sessionDir);
  if (sonuc === 'eklendi' || sonuc === 'duzeltildi') justConfigured = true;
  if (sonuc === 'duzeltildi') {
    notes.push(
      `Ekip hafızası yeni yerine yönlendirildi: ${localPath} içindeki eski autoMemoryDirectory (mukellef-takip/docs/ai/memory) → ${memoryDir}. ` +
        'Depo 2026-10-24\'te yeniden yapılandı (eski/ + yeni kök); bu makinede henüz yapılmadıysa kullanıcıya `node tools/ajan/eski-yerel-tasi.mjs` çalıştırmasını öner.',
    );
  } else if (typeof sonuc === 'object') {
    notes.push(
      `Uyarı: ${localPath} içinde autoMemoryDirectory başka bir dizini gösteriyor (${sonuc.farkli}). ` +
        `Ekip hafızası ${memoryDir}; kullanıcıya bunu değiştirmek isteyip istemediğini sor, kendiliğinden değiştirme.`,
    );
  }
} catch (err) {
  notes.push(`Uyarı: ${localPath} okunamadı/yazılamadı (${err.message}); ekip hafızası otomatik etkinleşmedi.`);
}

if (justConfigured) {
  notes.push(
    `Ekip hafızası bu makinede etkin: autoMemoryDirectory → ${memoryDir}. ` +
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

// 3) Ekipten gelen değişiklikler (güvenliyse ileri sarar, senkronu çalıştırır, değişen bağlamı bildirir)
try {
  const out = execFileSync(process.execPath, [join(KOK, 'tools', 'ajan', 'guncelle.mjs'), '--ajan', 'claude'], {
    cwd: KOK,
    encoding: 'utf8',
    timeout: 25000,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (out) notes.push(out);
} catch {
  // Ağ zaman aşımı vb.; oturumu engelleme.
}

// 4) Ekip hafızasındaki son değişiklikler (başkalarının öğrendikleri)
try {
  const log = git(KOK, ['log', '--since=14.days', '-n', '5', '--date=short', '--format=%h %ad %an: %s', '--', 'docs/ai/memory']).trim();
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
