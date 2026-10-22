#!/usr/bin/env node
// Claude Code Stop kancası — kodda commitlenmemiş değişiklik varken Claude'u iş bitirme adımlarına yönlendirir
// (tools/ajan/claude.ps1 -Mod bitir -Ajan: belgeler, ekip hafızası, testler, tüm regresyon).
// Aynı dosya kümesi için bir kez hatırlatır (durum: .git/ajan-bitir.json; commit edilince sıfırlanır).
// stop_hook_active iken (Claude zaten yönlendirildi) ve AJAN_BITIR=off ise engellemez. Hata olursa hiç engellemez.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODE_DIRS = ['apps', 'packages', 'infra', 'tools'];

const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const git = (args) =>
  execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });

const input = readStdin();
if (input.stop_hook_active || process.env.AJAN_BITIR === 'off') process.exit(0);

try {
  const dirs = CODE_DIRS.filter((d) => existsSync(join(projectRoot, d)));
  const changed = git(['status', '--porcelain', '--', ...dirs])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  const statePath = resolve(projectRoot, git(['rev-parse', '--git-path', 'ajan-bitir.json']).trim());

  if (changed.length === 0) {
    rmSync(statePath, { force: true });
    process.exit(0);
  }

  let reminded = [];
  try {
    reminded = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    // İlk hatırlatma.
  }
  const fresh = changed.filter((f) => !reminded.includes(f));
  if (fresh.length === 0) process.exit(0);
  writeFileSync(statePath, JSON.stringify([...new Set([...reminded, ...changed])]));

  const shell = process.platform === 'win32' ? 'powershell' : 'pwsh';
  const script = join(projectRoot, 'tools', 'ajan', 'claude.ps1');
  const list = fresh.slice(0, 5).join(', ') + (fresh.length > 5 ? ` ve ${fresh.length - 5} dosya daha` : '');
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Kodda commitlenmemiş değişiklik var (${list}). ` +
        `İş tamamlandıysa şimdi \`${shell} -NoProfile -ExecutionPolicy Bypass -File "${script}" -Mod bitir -Ajan\` ` +
        'komutunu çalıştır ve çıktısındaki iş bitirme adımlarını uygula. ' +
        'İş henüz bitmediyse (kullanıcıyla sürüyor) yalnız iş bitince hangi adımların kalacağını bir cümleyle söyle ve dur.',
    }),
  );
} catch {
  // git yoksa ya da depo dışındaysa engelleme.
}
process.exit(0);
