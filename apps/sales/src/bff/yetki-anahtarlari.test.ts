import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { features } from '@eworks/feature-registry';

// Kural 7 (05 §3.4), satış portalı: her sayfa ve BFF ucu feature-registry'den bir `satis.*` yetki anahtarı bildirir.
// Herkese açık rotalar (oturum öncesi giriş adımları) gerekçesiyle ACIK'tadır. Yeni koruma yardımcısı yazılırsa buraya eklenir.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(SRC, 'app');

const ACIK: Record<string, string> = {
  'giris/page.tsx': 'giriş ekranı, oturum öncesi',
  'giris/dogrula/page.tsx': 'ikinci adım: yalnız parolası doğrulanmış ara adım çereziyle açılır, iş verisi yok',
  'giris/kurulum/page.tsx': 'ilk giriş 2FA kurulumu: yalnız ara adım çereziyle, iş verisi yok',
  'api/oturum/giris/route.ts': 'giriş isteği, oturum öncesi (aynı köken denetimi var)',
  'api/oturum/dogrula/route.ts': 'ikinci adım isteği, ara adım çereziyle (aynı köken denetimi var)',
  'api/oturum/kurulum/route.ts': '2FA kurulum onayı, ara adım çereziyle (aynı köken denetimi var)',
  'api/saglik/route.ts': 'sağlık denetimi, iş verisi yok',
};

const SAYFA_KORUMASI = /\bsatisSayfaIzni\(\s*'([^']+)'/g;
const UC_KORUMASI = /\bsatisApiIzni\(\s*req\s*,\s*'([^']+)'/g;
const ISLEYICI = /^export\s+(?:async\s+function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/gm;

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dosyalar(join(dizin, e.name)) : [join(dizin, e.name)]));
}

const goreli = (f: string) => relative(APP, f).replaceAll('\\', '/');
const anahtarlar = (metin: string, desen: RegExp) => [...metin.matchAll(desen)].map((m) => m[1] as string);
const gecerli = (k: string) => Object.hasOwn(features, k) && (k === 'satis' || k.startsWith('satis.'));

const rotalar = dosyalar(APP).filter((f) => /(^|[\\/])(page\.tsx|route\.ts)$/.test(f));
const korunan = rotalar.filter((f) => !(goreli(f) in ACIK));

describe('satış portalı yetki anahtarı bildirimi (kural 7)', () => {
  it('her korunan sayfa satisSayfaIzni ile kayıttaki bir satis.* anahtarını bildirir', () => {
    const sorunlar = korunan
      .filter((f) => f.endsWith('page.tsx'))
      .flatMap((f) => {
        const k = anahtarlar(readFileSync(f, 'utf8'), SAYFA_KORUMASI);
        if (k.length === 0) return [`${goreli(f)}: satisSayfaIzni('<anahtar>') yok`];
        return k.filter((x) => !gecerli(x)).map((x) => `${goreli(f)}: '${x}' kayıtta yok ya da satis.* değil`);
      });
    expect(sorunlar).toEqual([]);
  });

  it('her korunan uç, her işleyicisi için kayıttaki bir satis.* anahtarıyla korunur', () => {
    const sorunlar = korunan
      .filter((f) => f.endsWith('route.ts'))
      .flatMap((f) => {
        const metin = readFileSync(f, 'utf8');
        const k = anahtarlar(metin, UC_KORUMASI);
        const isleyici = metin.match(ISLEYICI)?.length ?? 0;
        const eksik = k.length < isleyici ? [`${goreli(f)}: ${isleyici} işleyici, ${k.length} koruma çağrısı`] : [];
        return [...eksik, ...k.filter((x) => !gecerli(x)).map((x) => `${goreli(f)}: '${x}' kayıtta yok ya da satis.* değil`)];
      });
    expect(sorunlar).toEqual([]);
  });

  it('açık rota listesi güncel (silinen rota listede kalmaz)', () => {
    const var_ = new Set(rotalar.map(goreli));
    expect(Object.keys(ACIK).filter((k) => !var_.has(k))).toEqual([]);
  });
});
