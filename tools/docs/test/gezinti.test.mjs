// Belge gezinti yolu (tools/docs/gezinti.mjs): hiyerarşik yol satırı, blokların yerleştirilmesi ve denetim.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { denetle, TABLO, uygula, yolSatiri } from '../gezinti.mjs';

const tablo = {
  'docs/00-genel-bakis.md': { ebeveyn: 'README.md', etiket: 'Genel bakış' },
  'docs/hedef-mimari/01.md': { ebeveyn: 'docs/00-genel-bakis.md', etiket: '01 Hedef mimari' },
  'docs/hedef-mimari/02.md': { ebeveyn: 'docs/hedef-mimari/01.md', etiket: '02 Kurum entegrasyonu' },
  'deploy/README.md': { ebeveyn: 'README.md', etiket: 'deploy' },
};

test('iç içe belgenin yolu kökten başlar, göreli bağlantılı ve son öğe kalındır', () => {
  assert.equal(
    yolSatiri('docs/hedef-mimari/02.md', tablo),
    '[README](../../README.md) › [Genel bakış](../00-genel-bakis.md) › [01 Hedef mimari](01.md) › **02 Kurum entegrasyonu**',
  );
  assert.equal(yolSatiri('deploy/README.md', tablo), '[README](../README.md) › **deploy**');
});

test('tabloda olmayan belgenin yolu yoktur', () => {
  assert.equal(yolSatiri('docs/yeni.md', tablo), null);
});

test('uygula üstte ve altta blok ekler; ikinci kez koşunca metin değişmez', () => {
  const metin = '# Başlık\n\nGövde.\n';
  const bir = uygula(metin, 'YOL');
  assert.match(bir, /^<!-- gezinti[^\n]*-->\nYOL\n<!-- \/gezinti -->\n\n# Başlık\n\nGövde\.\n\n<!-- gezinti[^\n]*-->\n\n---\n\nYOL\n<!-- \/gezinti -->\n$/);
  assert.equal(uygula(bir, 'YOL'), bir);
});

test('var olan blok yerinde güncellenir', () => {
  const eski = uygula('# Başlık\n\nGövde.\n', 'ESKİ');
  const yeni = uygula(eski, 'YENİ');
  assert.equal(yeni, uygula('# Başlık\n\nGövde.\n', 'YENİ'));
  assert.doesNotMatch(yeni, /ESKİ/);
});

test('kod bloğundaki benzer metne dokunulmaz', () => {
  const metin = '# Başlık\n\n```md\n<!-- gezinti — örnek -->\nX\n<!-- /gezinti -->\n```\n\nSon.\n';
  const sonuc = uygula(metin, 'YOL');
  assert.ok(sonuc.includes('```md\n<!-- gezinti — örnek -->\nX\n<!-- /gezinti -->\n```\n\nSon.'));
  assert.equal(uygula(sonuc, 'YOL'), sonuc);
});

test('CRLF satır sonları korunur', () => {
  const sonuc = uygula('# Başlık\r\n\r\nGövde.\r\n', 'YOL');
  assert.doesNotMatch(sonuc, /(?<!\r)\n/);
  assert.equal(sonuc.replace(/\r\n/g, '\n'), uygula('# Başlık\n\nGövde.\n', 'YOL'));
});

function depo(dosyalar) {
  const kok = mkdtempSync(join(tmpdir(), 'gezinti-'));
  execFileSync('git', ['init', '-q'], { cwd: kok });
  for (const [yol, metin] of Object.entries(dosyalar)) {
    mkdirSync(dirname(join(kok, yol)), { recursive: true });
    writeFileSync(join(kok, yol), metin);
  }
  return kok;
}

test('denetim: tabloda olmayan kapsam belgesi ve eski blok hata verir; --yaz sonrası temiz', () => {
  const kok = depo({
    'README.md': '# Kök\n',
    'docs/00-genel-bakis.md': '# Genel\n',
    'docs/hedef-mimari/01.md': '# 01\n',
    'docs/hedef-mimari/02.md': '# 02\n',
    'docs/baglamlar/yeni.md': '# Yeni\n',
    'docs/ai/memory/kayit.md': '# Kapsam dışı\n',
  });
  const once = denetle(kok, { tablo });
  assert.ok(once.sorunlar.some((s) => s.startsWith('docs/baglamlar/yeni.md') && s.includes('TABLO')));
  assert.ok(once.sorunlar.some((s) => s.startsWith('docs/hedef-mimari/02.md')));
  assert.ok(!once.sorunlar.some((s) => s.includes('memory') || s.startsWith('README.md')));

  denetle(kok, { tablo, yaz: true });
  assert.match(readFileSync(join(kok, 'docs/hedef-mimari/02.md'), 'utf8'), /\*\*02 Kurum entegrasyonu\*\*/);
  const sonra = denetle(kok, { tablo });
  assert.deepEqual(sonra.sorunlar, ['docs/baglamlar/yeni.md: gezinti TABLO\'sunda yok; tools/docs/gezinti.mjs içine ebeveyn ve etiketiyle ekle']);
});

test('gerçek tablodaki her ebeveyn ya kök README ya da tablodaki bir belgedir', () => {
  for (const [yol, { ebeveyn }] of Object.entries(TABLO)) {
    assert.ok(ebeveyn === 'README.md' || TABLO[ebeveyn], `${yol} → ${ebeveyn}`);
  }
});
