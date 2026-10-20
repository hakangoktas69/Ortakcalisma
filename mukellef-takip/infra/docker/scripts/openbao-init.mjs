#!/usr/bin/env node
// OpenBao ilk kurulumu (üretim). Kullanım (proje kökünde, yığın ayaktayken):
//   node infra/docker/scripts/openbao-init.mjs
// - Kasayı kurar ve açar, Transit anahtarını ve uygulama politikasını oluşturur.
// - Uygulama anahtarını ve sarılmış veri anahtarını infra/docker/secrets/ altına yazar.
// - 3 açma (unseal) anahtarını YALNIZ BİR KEZ ekrana yazar: farklı yetkililere dağıtın, çevrim dışı saklayın.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dockerDir = join(here, '..');
const compose = ['compose', '-f', join(dockerDir, 'compose.yml'), '-f', join(dockerDir, 'compose.prod.yml'), '--env-file', join(dockerDir, '.env')];

const out = execFileSync('docker', [...compose, 'exec', '-T', 'openbao', 'sh', '-s'], {
  input: readFileSync(join(dockerDir, 'openbao', 'init.sh')),
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'inherit'],
});
const values = Object.fromEntries(out.trim().split('\n').map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
for (const k of ['OPENBAO_TOKEN', 'OPENBAO_WRAPPED_DEK', 'UNSEAL_KEY_1']) if (!values[k]) throw new Error(`OpenBao kurulum çıktısında ${k} yok`);

writeFileSync(join(dockerDir, 'secrets', 'openbao_token'), values.OPENBAO_TOKEN, { mode: 0o600 });
writeFileSync(join(dockerDir, 'secrets', 'openbao_wrapped_dek'), values.OPENBAO_WRAPPED_DEK, { mode: 0o600 });

console.log('\nOpenBao kuruldu. Uygulama anahtarı ve sarılmış veri anahtarı secrets/ altına yazıldı.');
console.log('Açma anahtarları (BİR KEZ gösterilir — herhangi 2 tanesi kasayı açar; ayrı kişilerde, çevrim dışı saklayın):\n');
for (const i of [1, 2, 3]) console.log(`  ${i}: ${values[`UNSEAL_KEY_${i}`]}`);
console.log('\nŞimdi api ve worker\'ı yeniden başlatın: docker compose ... up -d api worker');
