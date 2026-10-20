#!/usr/bin/env node
// Tam doğrulama — her derleme / dağıtımdan önce (npm run verify, stack:dev, stack:prod):
//   1) statik: lint (api + web), katman kuralları, tip denetimi (api + web)
//   2) birim testleri: api (kapsam eşikli) + web
//   3) API regresyon testleri: gerçek PostgreSQL (RLS) + Redis ile her context'in bütün uçları, worker, ödeme akışı
// Hepsi izole bir Docker yığınında, Node 24 ile çalışır; yerel Node sürümünden bağımsızdır. Bir adım düşerse çıkış kodu ≠ 0.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const compose = ['compose', '-f', join(root, 'infra', 'docker', 'compose.test.yml')];
const docker = (...args) => spawnSync('docker', [...compose, ...args], { stdio: 'inherit', cwd: root }).status ?? 1;

console.log('▶ Doğrulama: statik kontroller, birim ve API regresyon testleri (izole test yığını)');
let code = 1;
try {
  code = docker('run', '--rm', '--build', 'verify');
} finally {
  docker('down', '-v', '--remove-orphans');
}
console.log(code === 0 ? '✔ Doğrulama başarılı' : '✖ Doğrulama başarısız — derleme/dağıtım durduruldu');
process.exit(code);
