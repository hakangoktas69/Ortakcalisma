import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { features } from '@eworks/feature-registry';

// Kural 10 (05 §3.4): her sayfa, BFF ucu ve server action feature-registry'den bir yetki anahtarı bildirir.
// Rotaları tarar: sayfa sayfaIzni('<anahtar>'), uç her işleyicisi için bir koruma çağrısı (apiIzni, eBeyannameIsi) yapar;
// anahtar kayıtta olmalıdır. Herkese açık rotalar gerekçesiyle ACIK'tadır. Yeni bir koruma yardımcısı yazılırsa buraya eklenir.

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(SRC, 'app');

const ACIK: Record<string, string> = {
  'giris/page.tsx': 'giriş ekranı, oturum öncesi',
  'api/oturum/giris/route.ts': 'giriş isteği, oturum öncesi',
  'api/saglik/route.ts': 'sağlık denetimi, iş verisi yok',
  '(panel)/firmalar/kart/page.tsx': 'yalnız listeye yönlendirir',
  '(panel)/[...yol]/page.tsx': 'kırmızı yer tutucu; anahtar yoldan türetilir ve kayıtta aranır',
};

const SAYFA_KORUMASI = /\bsayfaIzni\(\s*'([^']+)'/g;
const UC_KORUMASI = /\b(?:apiIzni|eBeyannameIsi)\(\s*req\s*,\s*'([^']+)'/g;
const ISLEM_DENETIMI = /\bizin\(\s*'([^']+)'/g;
const ISLEYICI = /^export\s+(?:async\s+function|const)\s+(?:GET|POST|PUT|PATCH|DELETE)\b/gm;

function dosyalar(dizin: string): string[] {
  return readdirSync(dizin, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dosyalar(join(dizin, e.name)) : [join(dizin, e.name)]));
}

const goreli = (f: string) => relative(APP, f).replaceAll('\\', '/');
const anahtarlar = (metin: string, desen: RegExp) => [...metin.matchAll(desen)].map((m) => m[1] as string);
const kayitta = (k: string) => Object.hasOwn(features, k);

const rotalar = dosyalar(APP).filter((f) => /(^|[\\/])(page\.tsx|route\.ts)$/.test(f));
const korunan = rotalar.filter((f) => !(goreli(f) in ACIK));

describe('yetki anahtarı bildirimi (kural 10)', () => {
  it('her korunan sayfa sayfaIzni ile kayıttaki bir anahtarı bildirir', () => {
    const sorunlar = korunan
      .filter((f) => f.endsWith('page.tsx'))
      .flatMap((f) => {
        const k = anahtarlar(readFileSync(f, 'utf8'), SAYFA_KORUMASI);
        if (k.length === 0) return [`${goreli(f)}: sayfaIzni('<anahtar>') yok`];
        return k.filter((x) => !kayitta(x)).map((x) => `${goreli(f)}: '${x}' feature-registry'de yok`);
      });
    expect(sorunlar).toEqual([]);
  });

  it('her korunan uç, her işleyicisi için kayıttaki bir anahtarla korunur', () => {
    const sorunlar = korunan
      .filter((f) => f.endsWith('route.ts'))
      .flatMap((f) => {
        const metin = readFileSync(f, 'utf8');
        const k = anahtarlar(metin, UC_KORUMASI);
        const isleyici = metin.match(ISLEYICI)?.length ?? 0;
        const eksik = k.length < isleyici ? [`${goreli(f)}: ${isleyici} işleyici, ${k.length} koruma çağrısı`] : [];
        return [...eksik, ...k.filter((x) => !kayitta(x)).map((x) => `${goreli(f)}: '${x}' feature-registry'de yok`)];
      });
    expect(sorunlar).toEqual([]);
  });

  it('sayfa içindeki işlem denetimleri de kayıttaki anahtarları kullanır', () => {
    const sorunlar = rotalar.flatMap((f) =>
      anahtarlar(readFileSync(f, 'utf8'), ISLEM_DENETIMI)
        .filter((x) => !kayitta(x))
        .map((x) => `${goreli(f)}: '${x}' feature-registry'de yok`),
    );
    expect(sorunlar).toEqual([]);
  });

  it('herkese açık rota listesi güncel', () => {
    const var_ = new Set(rotalar.map(goreli));
    expect(Object.keys(ACIK).filter((r) => !var_.has(r))).toEqual([]);
  });

  it("server action'lar bu denetime eklenmeden yazılmaz", () => {
    const eylemler = dosyalar(SRC).filter((f) => /\.tsx?$/.test(f) && /^\s*['"]use server['"]/m.test(readFileSync(f, 'utf8')));
    // İlk server action yazıldığında koruma yardımcısı ve bu test birlikte genişletilir.
    expect(eylemler.map((f) => relative(SRC, f))).toEqual([]);
  });
});
