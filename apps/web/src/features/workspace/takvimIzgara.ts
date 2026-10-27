// Takvim ekranının tarih ızgarası ve görünüm aralıkları (yalnız sunum hesabı; iş kuralı workspace takviminde).
// Tarihler 'YYYY-MM-DD', aritmetik UTC'de (saat dilimi kayması yok). Hafta pazartesi başlar.
import { addDays, validDate } from '@eworks/workspace';

export type Gorunum = 'ay' | 'hafta' | 'gun' | 'yil' | 'liste';
export const GORUNUMLER: readonly { id: Gorunum; baslik: string }[] = [
  { id: 'ay', baslik: 'Ay' },
  { id: 'hafta', baslik: 'Hafta' },
  { id: 'gun', baslik: 'Gün' },
  { id: 'yil', baslik: 'Yıl' },
  { id: 'liste', baslik: 'Liste' },
];

const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
// Gün aritmetiği ve tarih doğrulaması takvim alanıyla aynı (iki kopya ayrışmasın)
export const gunEkle = addDays;
const gecerli = validDate;
const ayBasi = (s: string) => `${s.slice(0, 7)}-01`;
const aySonu = (s: string) => iso(new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 0)));
const pazartesi = (s: string) => gunEkle(s, -((utc(s).getUTCDay() + 6) % 7));

/** 6 hafta × 7 gün; ilk hücre ayın ilk gününün haftasının pazartesisi. */
export function ayIzgarasi(tarih: string): { tarih: string; buAy: boolean }[] {
  const ilk = pazartesi(ayBasi(tarih));
  const ay = tarih.slice(0, 7);
  return Array.from({ length: 42 }, (_, i) => {
    const t = gunEkle(ilk, i);
    return { tarih: t, buAy: t.startsWith(ay) };
  });
}

export const haftaGunleri = (tarih: string) => Array.from({ length: 7 }, (_, i) => gunEkle(pazartesi(tarih), i));

export function araligi(g: Gorunum, tarih: string): { from: string; to: string } {
  if (g === 'ay') return { from: ayIzgarasi(tarih)[0]!.tarih, to: ayIzgarasi(tarih)[41]!.tarih };
  if (g === 'hafta') return { from: pazartesi(tarih), to: gunEkle(pazartesi(tarih), 6) };
  if (g === 'gun') return { from: tarih, to: tarih };
  if (g === 'yil') return { from: `${tarih.slice(0, 4)}-01-01`, to: `${tarih.slice(0, 4)}-12-31` };
  return { from: ayBasi(tarih), to: aySonu(tarih) };
}

/** Önceki/sonraki dönem. Ay ve liste ayın ilk gününe gider (31 Ocak + 1 ay taşmasın). */
export function kaydir(g: Gorunum, tarih: string, yon: 1 | -1): string {
  if (g === 'hafta') return gunEkle(tarih, 7 * yon);
  if (g === 'gun') return gunEkle(tarih, yon);
  if (g === 'yil') return `${Number(tarih.slice(0, 4)) + yon}-01-01`;
  const y = Number(tarih.slice(0, 4));
  const m = Number(tarih.slice(5, 7)) - 1 + yon;
  return iso(new Date(Date.UTC(y, m, 1)));
}

export function gorunumOku(a: { gorunum?: string; tarih?: string }, bugun: string): { gorunum: Gorunum; tarih: string } {
  const gorunum = GORUNUMLER.find((x) => x.id === a.gorunum)?.id ?? 'ay';
  return { gorunum, tarih: a.tarih && gecerli(a.tarih) ? a.tarih : bugun };
}

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const ayAdi = (tarih: string) => `${AYLAR[Number(tarih.slice(5, 7)) - 1]} ${tarih.slice(0, 4)}`;
export const uzunTarih = (tarih: string) => new Intl.DateTimeFormat('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(utc(tarih));
export const haftaSonu = (tarih: string) => [0, 6].includes(utc(tarih).getUTCDay());
