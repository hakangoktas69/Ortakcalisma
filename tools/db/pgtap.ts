// pgTAP koşucusu (06 §6, §7.2): supabase/tests/{tenant,control}/**/*.sql dosyalarını ilgili veritabanlarında, her biri geri alınan
// bir işlemde çalıştırır; TAP çıktısını JUnit'e çevirir (test-results/pgtap.xml) — özellik durumu @F: etiketlerini buradan da okur.
// Dosya başındaki `-- @F:<anahtar>` satırları dosyadaki her teste etiket olarak eklenir.
// Ortam: TEST_CONTROL_URL, TEST_SHARD_URLS (yönetici). Kullanım: node tools/db/pgtap.ts
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export type TapResult = { readonly name: string; readonly ok: boolean; readonly diag: string };

/** pgTAP satırlarını (ok 1 - ad / not ok 2 - ad / # tanı) sonuçlara çevirir; plan sayısı tutmazsa eksikleri başarısız sayar. */
export function parseTap(lines: readonly string[]): TapResult[] {
  const out: TapResult[] = [];
  let planned = 0;
  for (const l of lines) {
    const p = /^1\.\.(\d+)/.exec(l);
    if (p) planned = Number(p[1]);
    const m = /^(not ok|ok) (\d+)(?: - (.*))?$/.exec(l);
    if (m) out.push({ name: m[3] ?? `test ${m[2]}`, ok: m[1] === 'ok', diag: '' });
    else if (l.startsWith('#') && out.length > 0) {
      const last = out[out.length - 1]!;
      out[out.length - 1] = { ...last, diag: `${last.diag}${l}\n` };
    }
  }
  for (let i = out.length; i < planned; i++) out.push({ name: `planlanan test ${i + 1} çalışmadı`, ok: false, diag: '' });
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function junit(suites: { file: string; tags: string[]; results: TapResult[] }[]): string {
  const cases = suites.flatMap((s) =>
    s.results.map((r) => {
      const name = esc(`${s.tags.map((t) => `@F:${t} `).join('')}${r.name}`);
      return `    <testcase classname="${esc(s.file)}" name="${name}">${r.ok ? '' : `<failure message="pgTAP">${esc(r.diag)}</failure>`}</testcase>`;
    }),
  );
  const fail = suites.flatMap((s) => s.results).filter((r) => !r.ok).length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n  <testsuite name="pgtap" tests="${cases.length}" failures="${fail}">\n${cases.join('\n')}\n  </testsuite>\n</testsuites>\n`;
}

const sqlFiles = (dir: string): string[] => {
  try {
    return readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? sqlFiles(p) : e.endsWith('.sql') ? [p] : [];
    }).sort();
  } catch {
    return [];
  }
};

async function runFile(url: string, file: string): Promise<TapResult[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    await c.query('create extension if not exists pgtap');
    await c.query('begin');
    const res = await c.query(readFileSync(file, 'utf8'));
    const lines = (Array.isArray(res) ? res : [res]).flatMap((r) => r.rows.map((row: Record<string, unknown>) => String(Object.values(row)[0] ?? '')));
    return parseTap(lines.flatMap((l) => l.split('\n')));
  } catch (err) {
    return [{ name: 'dosya çalıştırılamadı', ok: false, diag: `# ${(err as Error).message}\n` }];
  } finally {
    await c.query('rollback').catch(() => {});
    await c.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const shards = (process.env['TEST_SHARD_URLS'] ?? '').split(',').filter(Boolean).map((s) => s.slice(s.indexOf('=') + 1));
  const control = process.env['TEST_CONTROL_URL'];
  if (!control || shards.length === 0) {
    console.error('✖ TEST_CONTROL_URL / TEST_SHARD_URLS tanımlı değil (node tools/deploy/yigin.mjs test)');
    process.exit(2);
  }
  const suites = [];
  for (const [kind, urls] of [['tenant', shards.slice(0, 1)], ['control', [control]]] as const) {
    for (const file of sqlFiles(join(root, 'supabase', 'tests', kind))) {
      const tags = [...readFileSync(file, 'utf8').matchAll(/^--\s*@F:([a-z0-9_.]+)/gm)].map((m) => m[1]!);
      for (const url of urls) suites.push({ file: relative(root, file).replaceAll('\\', '/'), tags, results: await runFile(url, file) });
    }
  }
  mkdirSync(join(root, 'test-results'), { recursive: true });
  writeFileSync(join(root, 'test-results', 'pgtap.xml'), junit(suites));
  const all = suites.flatMap((s) => s.results);
  for (const s of suites) for (const r of s.results.filter((x) => !x.ok)) console.error(`✖ ${s.file}: ${r.name}\n${r.diag}`);
  console.log(`${all.every((r) => r.ok) ? '✔' : '✖'} pgTAP: ${all.filter((r) => r.ok).length}/${all.length} (${suites.length} dosya)`);
  process.exit(all.every((r) => r.ok) ? 0 : 1);
}
