import type { Result } from '@eworks/kernel';
import type { GibCalendarSnapshot, YearSources } from '@eworks/workspace';

// İşçinin takvim döngüsü (workspace takvimi): her ofisin shard'ındaki takvim kopyası hazır kaynaktan (GİB 2026, Diyanet,
// yasa ve kural tarihleri) doldurulur. GİB verisi eksik yıllar ayrıca bildirilir (kurumdan çekme işi). Bir ofisin hatası
// diğerlerini durdurmaz; hata yalnız sayılır (kişisel veri yok).

type Hazirlama = Result<{ written: number; needsGib: boolean }, string>;

/** İstanbul takvimine göre bulunulan yıl; Ekim ve sonrasında gelecek yıl da hazırlanır. */
export function takvimYillari(simdi: Date): number[] {
  const [yil, ay] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit' }).format(simdi).split('-').map(Number);
  return ay! >= 10 ? [yil!, yil! + 1] : [yil!];
}

export async function takvimHazirla(ofisler: readonly string[], yillar: readonly number[], hazirla: (org: string, yil: number) => Promise<Hazirlama>) {
  let yazilan = 0;
  let hata = 0;
  const gibEksik: { org: string; yil: number }[] = [];
  for (const org of ofisler) {
    try {
      for (const yil of yillar) {
        const r = await hazirla(org, yil);
        if (!r.ok) {
          hata++;
          continue;
        }
        yazilan += r.value.written;
        if (r.value.needsGib) gibEksik.push({ org, yil });
      }
    } catch {
      hata++;
    }
  }
  return { yazilan, gibEksik, hata };
}

// Ortak takvim kaynağı: kamuya açık veri (GİB vergi takvimi, Nager.Date) yıl başına bir kez çekilir; doğrulanmış sonuç ortak
// anahtarda tutulur ve her ofisin shard'ındaki kopyaya kuruma yeniden gitmeden uygulanır (500 ofis = 500 aynı istek olmasın).
// Taze değilse (7 gün) ya da yoksa yıl başına yalnız bir ofis için iş istenir. Veri kişisel değildir, ofisler arası paylaşılabilir.

export const ORTAK_TAZELIK_MS = 7 * 86_400_000;
export const ortakAnahtar = (yil: number) => `ortak/takvim/${yil}.json`;

type Bayram = { ramazan: string; kurban: string; certain: boolean; sourceUrl: string; checkedAt: string };
export type OrtakTakvim = { year: number; observedAt: string; gib: GibCalendarSnapshot | null; religious: Bayram | null };

/** Ortak sonucu workspace takvim kaynağına çevirir. */
export const ortakKaynak = (o: OrtakTakvim): YearSources => ({
  ...(o.gib ? { gib: o.gib } : {}),
  ...(o.religious ? { religious: { dates: { ramazan: o.religious.ramazan, kurban: o.religious.kurban }, certain: o.religious.certain, sourceUrl: o.religious.sourceUrl, checkedAt: o.religious.checkedAt } } : {}),
});

export async function eksikleriTamamla(
  eksik: readonly { org: string; yil: number }[],
  simdi: Date,
  d: {
    ortakOku: (yil: number) => Promise<OrtakTakvim | null>;
    uygula: (org: string, yil: number, kaynak: YearSources) => Promise<void>;
    iste: (org: string, yil: number) => Promise<void>;
    /** Yalnız bayram içeren ortak sonucun bu süreçte hangi ofislere uygulandığı (her döngüde yeniden yazılmasın). */
    bellek: Map<number, Set<string>>;
  },
) {
  let uygulanan = 0;
  let istenen = 0;
  for (const yil of [...new Set(eksik.map((e) => e.yil))]) {
    const ofisler = eksik.filter((e) => e.yil === yil).map((e) => e.org);
    const o = await d.ortakOku(yil);
    const taze = o !== null && Number.isFinite(Date.parse(o.observedAt)) && simdi.getTime() - Date.parse(o.observedAt) <= ORTAK_TAZELIK_MS;
    if (!taze) {
      try {
        await d.iste(ofisler[0]!, yil);
        istenen++;
      } catch {
        // İş açılamadı (veritabanı kesintisi): sonraki döngüde yeniden denenir
      }
      continue;
    }
    if (!o.gib && !o.religious) continue;
    const yapilan = d.bellek.get(yil) ?? new Set<string>();
    d.bellek.set(yil, yapilan);
    for (const org of ofisler) {
      if (!o.gib && yapilan.has(org)) continue;
      try {
        await d.uygula(org, yil, ortakKaynak(o));
        yapilan.add(org);
        uygulanan++;
      } catch {
        // Ofisin shard'ı erişilemez ya da ofis yarım açılmış: diğer ofisler sürer, sonraki döngüde yeniden denenir
      }
    }
  }
  return { uygulanan, istenen };
}
