import { describe, expect, it } from 'vitest';
import { computeStatus } from '../../packages/feature-registry/src/index.ts';
import { parseJunit, renderMarkdown, summary } from './uret.ts';

const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="sgk">
    <testcase classname="packages/contexts/social-security/test/x.test.ts" name="[F:sgk.ebildirge.view] listeler" time="0.1"/>
    <testcase classname="x" name="@F:sgk.ebildirge.sync &amp; @F:sgk.kontrol.view iş açar"><failure message="beklenen"/></testcase>
    <testcase classname="x" name="@F:sgk.erapor.view"><skipped/></testcase>
    <testcase classname="x" name="etiketsiz"/>
  </testsuite>
</testsuites>`;

describe('JUnit okuma', () => {
  it('etiketli testleri, başarısız ve atlananları ayırır', () => {
    expect(parseJunit(xml)).toEqual([
      { feature: 'sgk.ebildirge.view', passed: true },
      { feature: 'sgk.ebildirge.sync', passed: false },
      { feature: 'sgk.kontrol.view', passed: false },
      { feature: 'sgk.erapor.view', passed: false },
    ]);
  });
});

describe('çıktılar', () => {
  const tree = {
    sgk: { title: 'SGK', kind: 'module', context: 'social-security' },
    'sgk.ebildirge': { title: 'e-Bildirge', kind: 'page' },
    'sgk.ebildirge.view': { title: 'Görüntüle', kind: 'action', acceptance: true },
    'sgk.ebildirge.sync': { title: 'Güncelle', kind: 'action', acceptance: true },
  } as const;
  const status = computeStatus(tree, parseJunit(xml));

  it('belge ağacı ilerlemeyle ve bilinmeyen etiketlerle yazar', () => {
    const md = renderMarkdown(tree, status, ['sgk.yok']);
    expect(md).toContain('| **SGK** | `sgk` | social-security | 🔴 1/2 | 2 |');
    expect(md).toContain('`sgk.ebildirge.view` | social-security | 🟢 | 1 |');
    expect(md).toContain('- `sgk.yok`');
  });

  it('README özeti', () => {
    expect(summary(tree, status)).toMatch(/^\*\*1\/2 işlem yeşil\*\* \(1 modül\)\. 🔴 SGK 1\/2/);
  });
});
