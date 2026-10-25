// Özellik durumu üretici (06 §8.2): test koşucularının JUnit çıktılarındaki @F:/[F:] etiketlerinden durum hesaplar.
// Çıktılar (elle düzenlenmez): packages/feature-registry/feature-status.json, docs/ozellik-durumu.md, README özet bloğu.
// Kullanım: node tools/features/uret.ts [--sonuclar test-results] [--denetle]   (Node 24: TypeScript doğrudan çalışır)
//   --denetle: hiçbir şey yazmaz; üretilenler test sonuçlarıyla uyumsuzsa 1 ile çıkar.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  childrenOf,
  computeStatus,
  contextOf,
  featureTags,
  features,
  liveVerifications,
  parentOf,
  type FeatureTree,
  type NodeStatus,
  type TestResult,
} from '../../packages/feature-registry/src/index.ts';

const unescapeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** JUnit XML'deki her testcase için etiketli sonuçları döner; skip/todo başarısız sayılır (06 §8.2). */
export function parseJunit(xml: string): TestResult[] {
  const out: TestResult[] = [];
  for (const m of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    const attr = (n: string) => unescapeXml(new RegExp(`\\b${n}="([^"]*)"`).exec(attrs)?.[1] ?? '');
    const passed = !/<(failure|error|skipped)\b/.test(body);
    for (const feature of new Set([...featureTags(attr('name')), ...featureTags(attr('classname'))])) out.push({ feature, passed });
  }
  return out;
}

const icon = (s: NodeStatus) => (s.status === 'green' ? '🟢' : '🔴');

export function renderMarkdown(tree: FeatureTree, status: Record<string, NodeStatus>, unknown: string[]): string {
  const lines = [
    '# Özellik durumu',
    '',
    '> **Üretilen dosya — elle düzenlemeyin.** Kaynak: `packages/feature-registry/src/features.ts` + test sonuçları; üretici `pnpm features` ([06 §8](hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#8-özellik-durumu-ve-ön-yüzde-kırmızıyeşil-işaretleme-d22)).',
    '> 🔴 tamamlanmadı (kabul testi yok ya da biri geçmiyor) · 🟢 tamamlandı. Sayılar: yeşil işlem / toplam işlem, test sayısı.',
    '> "canlı": kurumla konuşan işlem (D33) — sahte kurum testlerine ek olarak `packages/feature-registry/canli-dogrulamalar.json` kaydı ister.',
    '',
    '| Özellik | Anahtar | Bağlam | Durum | Testler |',
    '|---|---|---|---|---|',
  ];
  const walk = (key: string, depth: number) => {
    const f = tree[key];
    const s = status[key];
    if (!f || !s) return;
    const pad = depth === 0 ? `**${f.title}**` : `${'&nbsp;&nbsp;'.repeat(depth * 2)}${f.title}`;
    const ctx = contextOf(tree, key) ?? '— (atanmadı)';
    const progress = f.kind === 'action' ? (f.live ? ' canlı' : '') : ` ${s.green}/${s.total}`;
    lines.push(`| ${pad} | \`${key}\` | ${ctx} | ${icon(s)}${progress} | ${s.tests} |`);
    for (const c of childrenOf(tree, key)) walk(c, depth + 1);
  };
  for (const key of Object.keys(tree).filter((k) => parentOf(k) === null)) walk(key, 0);
  if (unknown.length > 0) {
    lines.push('', '## Kayıtta olmayan etiketler', '', 'Bu etiketler `features.ts`\'te yok; anahtarı ekleyin ya da etiketi düzeltin:', '');
    for (const u of unknown) lines.push(`- \`${u}\``);
  }
  return lines.join('\n') + '\n';
}

export function summary(tree: FeatureTree, status: Record<string, NodeStatus>): string {
  const roots = Object.keys(tree).filter((k) => parentOf(k) === null);
  const all = roots.map((k) => status[k]!).reduce((a, s) => ({ green: a.green + s.green, total: a.total + s.total }), { green: 0, total: 0 });
  const mods = roots.map((k) => `${icon(status[k]!)} ${tree[k]!.title} ${status[k]!.green}/${status[k]!.total}`).join(' · ');
  return `**${all.green}/${all.total} işlem yeşil** (${roots.length} modül). ${mods}. Ayrıntı: [docs/ozellik-durumu.md](docs/ozellik-durumu.md)`;
}

const BLOK = /(<!-- ozellik-durumu:baslangic[^>]*-->)[\s\S]*?(<!-- ozellik-durumu:bitis -->)/;

export function generate(root: string, resultsDir: string) {
  const results: TestResult[] = [];
  const dir = resolve(root, resultsDir);
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.xml'))) results.push(...parseJunit(readFileSync(join(dir, f), 'utf8')));
  }
  const status = computeStatus(features, results, liveVerifications);
  const unknown = [...new Set(results.map((r) => r.feature))].filter((k) => !features[k]).sort();
  const json = JSON.stringify(
    Object.fromEntries(Object.entries(status).map(([k, s]) => [k, { ...s, context: contextOf(features, k) }])),
    null,
    2,
  ) + '\n';
  const readmePath = join(root, 'README.md');
  const readme = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
  return {
    files: {
      'packages/feature-registry/feature-status.json': json,
      'docs/ozellik-durumu.md': renderMarkdown(features, status, unknown),
      ...(BLOK.test(readme) ? { 'README.md': readme.replace(BLOK, `$1\n${summary(features, status)}\n$2`) } : {}),
    } as Record<string, string>,
    unknown,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const i = process.argv.indexOf('--sonuclar');
  const { files, unknown } = generate(root, i > 0 ? process.argv[i + 1]! : 'test-results');
  const norm = (s: string) => s.replace(/\r\n/g, '\n');
  if (process.argv.includes('--denetle')) {
    const stale = Object.entries(files).filter(([p, c]) => !existsSync(join(root, p)) || norm(readFileSync(join(root, p), 'utf8')) !== norm(c));
    for (const [p] of stale) console.error(`✖ ${p} test sonuçlarıyla uyumsuz; pnpm features çalıştırın`);
    process.exit(stale.length > 0 ? 1 : 0);
  }
  for (const [p, c] of Object.entries(files)) writeFileSync(join(root, p), c);
  for (const u of unknown) console.warn(`⚠ kayıtta olmayan özellik etiketi: ${u}`);
  console.log(`✔ Özellik durumu üretildi: ${Object.keys(files).join(', ')}`);
}
