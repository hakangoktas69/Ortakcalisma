// Migration komutu (Compose `migrate` servisi, CI): kontrol düzlemine control/, her shard'a tenant/ migration'larını uygular,
// shard dizinini ortamdaki shard listesiyle eşitler ve uygulama giriş rollerinin parolalarını atar.
// Bağlantılar yönetici rolüyledir (MIGRATE_*); uygulamalar kendi kısıtlı rolleriyle bağlanır.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, migrate, parseShardUrls, readMigrations, setRolePasswords } from '@eworks/platform';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = (k: string) => join(process.env['MIGRATIONS_DIR'] ?? join(repo, 'supabase', 'migrations'), k);
const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} tanımlı değil`);
  return v;
};

export async function runAll(env = process.env) {
  const control = createPool(need('MIGRATE_CONTROL_URL'), 2);
  const shards = parseShardUrls(need('MIGRATE_SHARD_URLS'));
  try {
    const applied = await migrate(control, readMigrations(dir('control')));
    console.log(`kontrol düzlemi: ${applied.length ? applied.join(', ') : 'güncel'}`);
    for (const id of shards.keys()) {
      await control.query('insert into directory.shards(id) values ($1) on conflict (id) do nothing', [id]);
    }
    await setRolePasswords(control, { eworks_control: env['CONTROL_DB_PASSWORD'] });
  } finally {
    await control.end();
  }
  for (const [id, url] of shards) {
    const pool = createPool(url, 2);
    try {
      const applied = await migrate(pool, readMigrations(dir('tenant')));
      console.log(`${id}: ${applied.length ? applied.join(', ') : 'güncel'}`);
      await setRolePasswords(pool, {
        eworks_app: env['APP_DB_PASSWORD'],
        eworks_worker: env['WORKER_DB_PASSWORD'],
        eworks_integration: env['INTEGRATION_DB_PASSWORD'],
      });
    } finally {
      await pool.end();
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runAll().then(
    () => console.log('✔ migration tamam'),
    (err) => {
      console.error(`✖ ${(err as Error).message}`);
      process.exit(1);
    },
  );
}
