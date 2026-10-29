// Demo verisi üreteçleri: tohumlu rastgelelik ve sahte vergi kimlikleri. Her demo dilimi (firma, e-Tebligat, beyanname,
// görev) bunu kullanır, böylece aynı ofis her koşuda aynı veriyi alır.
//
// Kimlik üreticileri @eworks/testing'deki ile aynı algoritmadır; o paket yalnız test bağımlılığıdır (üretim imajında
// bulunmaz) ve entegrasyon yığını yardımcısını da dışa aktarır, bu yüzden burada tekrarlanır. Doğruluğu, kernel'in
// gerçek doğrulayıcısına (parseTaxId) karşı testle bağlanmıştır.

export const VARSAYILAN_TOHUM = 20261029;

/** Tohumlu, tekrarlanabilir sözde rastgele üretici (mulberry32): aynı tohum aynı demo verisini verir. */
export function tohumluRastgele(tohum: number): () => number {
  let a = tohum >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ofis adından türetilen tohum. VKN dizini (`directory.taxpayer_registry`) sistem genelinde tekildir — çakışma
 * yalnız `tax_id_hash` üzerinde, `org_id` dahil değil. Sabit tohumla ikinci bir demo ofisine hiç mükellef
 * açılamazdı (hepsi ilk ofiste 'active'). Aynı ad her koşuda aynı listeyi verir (tekrar çalıştırılabilirlik).
 */
export function adTohumu(ad: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (const ch of ad.normalize('NFC')) {
    h = (h ^ (ch.codePointAt(0) ?? 0)) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ VARSAYILAN_TOHUM) >>> 0;
}

export const hane = (rnd: () => number) => Math.floor(rnd() * 10);
export const sec = <T>(rnd: () => number, liste: readonly T[]): T => liste[Math.floor(rnd() * liste.length)] as T;

/** Kontrol hanesi geçerli, sahte TCKN. 99 ile başlar: gerçek kişiyle çakışmaz, sahte olduğu bakınca anlaşılır. */
export function sahteTckn(rnd: () => number): string {
  const d = [9, 9, ...Array.from({ length: 7 }, () => hane(rnd))];
  const tek = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0) + (d[6] ?? 0) + (d[8] ?? 0);
  const cift = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0) + (d[7] ?? 0);
  d.push((((tek * 7 - cift) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}

/** Kontrol hanesi geçerli, sahte VKN (GİB algoritması). */
export function sahteVkn(rnd: () => number): string {
  const d = Array.from({ length: 9 }, () => hane(rnd));
  let toplam = 0;
  d.forEach((x, i) => {
    const t = (x + 9 - i) % 10;
    toplam += t === 0 ? 0 : (t * 2 ** (9 - i)) % 9 || 9;
  });
  return [...d, (10 - (toplam % 10)) % 10].join('');
}

/** Günü YYYY-MM-DD verir (UTC); gün sayısı eklenebilir. Tarih alanları gün çözünürlüğündedir. */
export const gunEkle = (temel: Date, gun: number): string => new Date(temel.getTime() + gun * 86400000).toISOString().slice(0, 10);
