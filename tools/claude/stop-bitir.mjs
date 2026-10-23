#!/usr/bin/env node
// Claude Code Stop kancası — kodda commitlenmemiş değişiklik varken Claude'u iş bitirme adımlarına yönlendirir
// (node tools/ajan/bitir.mjs --ajan claude: kaynak belgeler, ekip hafızası, senkron, testler, commit).
// Aynı dosya kümesi için bir kez hatırlatır (durum: .git/ajan-bitir.json; commit edilince sıfırlanır).
// stop_hook_active iken (Claude zaten yönlendirildi) ve AJAN_BITIR=off ise engellemez. Hata olursa hiç engellemez.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { git, KOK } from '../ajan/ortak.mjs';

const CODE_DIRS = ['packages', 'apps', 'services', 'contracts', 'supabase', 'deploy', 'tools'];

const readStdin = () => {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
};

const input = readStdin();
if (input.stop_hook_active || process.env.AJAN_BITIR === 'off') process.exit(0);

try {
  const dirs = CODE_DIRS.filter((d) => existsSync(join(KOK, d)));
  const changed = git(KOK, ['status', '--porcelain', '--', ...dirs])
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  const statePath = resolve(KOK, git(KOK, ['rev-parse', '--git-path', 'ajan-bitir.json']).trim());

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

  const list = fresh.slice(0, 5).join(', ') + (fresh.length > 5 ? ` ve ${fresh.length - 5} dosya daha` : '');
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `Kodda commitlenmemiş değişiklik var (${list}). ` +
        'İş tamamlandıysa şimdi `node tools/ajan/bitir.mjs --ajan claude` komutunu çalıştır ve çıktısındaki iş bitirme adımlarını uygula. ' +
        'İş henüz bitmediyse (kullanıcıyla sürüyor) yalnız iş bitince hangi adımların kalacağını bir cümleyle söyle ve dur.',
    }),
  );
} catch {
  // git yoksa ya da depo dışındaysa engelleme.
}
process.exit(0);
