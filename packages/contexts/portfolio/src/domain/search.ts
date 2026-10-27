// Firma araması (Mert'in 26.10 portal düzeltmesi): Türkçe/ASCII harf farkı ve büyük/küçük harf yok sayılır, sorgu kelimelere
// bölünür ve her kelime alanlardan birinde geçmelidir; sonuçlar unvan eşleşmesine göre sıralanır.

/** Karşılaştırma biçimi: küçük harf (tr-TR), aksanlar ve noktasız ı kaldırılır, boşluklar teke iner. */
export const normalizeSearch = (s: string) =>
  s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/\s+/g, ' ')
    .trim();

/** Boş sorgu her kaydı eşler. */
export function matchesSearch(fields: readonly (string | null | undefined)[], query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const text = normalizeSearch(fields.filter((v): v is string => !!v).join(' '));
  return q.split(' ').every((t) => text.includes(t));
}

/** 0 tam unvan, 1 unvanla başlayan, 2 unvanda geçen, 3 başka alanda geçen. */
export function searchRank(title: string, query: string): number {
  const t = normalizeSearch(title);
  const q = normalizeSearch(query);
  return t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 : 3;
}
