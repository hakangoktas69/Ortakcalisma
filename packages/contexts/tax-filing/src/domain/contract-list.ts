// GİB "Geçerli E-Beyanname Sözleşmeleri Listesi" kuralları (eski portal validateGib/mergeGib, robot validate_contracts).
// Fail-closed: sayı tutmazsa, kimlik geçersizse, aynı mükellef+sözleşme iki kez geldiyse liste hiç uygulanmaz.

export type ContractRow = {
  taxNumber: string;
  identityNumber: string;
  name: string;
  taxOffice: string;
  number: string;
  date: string;
  service: string;
  registeredAt: string;
  type: string;
};

export type ContractList = { count: number; contracts: ContractRow[] };

export type TaxpayerGroup = { taxId: string; name: string; taxOffice: string; contracts: ContractRow[] };

export type ListError = 'sayi_uyusmuyor' | 'kimlik_gecersiz' | 'eksik_alan' | 'tekrarlanan_sozlesme';

/** Listeyi doğrular ve mükellef (VKN/TCKN) bazında gruplar. VKN varsa VKN, yoksa TCKN kimliktir. */
export function groupContracts(list: ContractList): { ok: true; groups: TaxpayerGroup[] } | { ok: false; error: ListError } {
  if (!Number.isInteger(list.count) || list.count < 1 || list.count !== list.contracts.length) return { ok: false, error: 'sayi_uyusmuyor' };
  const seen = new Set<string>();
  const groups = new Map<string, TaxpayerGroup>();
  for (const r of list.contracts) {
    if (!r.name?.trim() || !r.number?.trim()) return { ok: false, error: 'eksik_alan' };
    const vkn = r.taxNumber?.trim() ?? '';
    const tckn = r.identityNumber?.trim() ?? '';
    // Liste düzeyinde biçim denetimi (eski robot): kontrol hanesi tutmayan tek kayıt canlı listenin tamamını reddettirmesin;
    // böyle bir mükellef firma kartı açılırken atlanır ve özet içinde sayılır.
    if ((!vkn && !tckn) || (vkn && !/^[0-9]{10}$/.test(vkn)) || (tckn && !/^[0-9]{11}$/.test(tckn))) return { ok: false, error: 'kimlik_gecersiz' };
    const taxId = vkn || tckn;
    const key = `${taxId}|${r.number.trim()}`;
    if (seen.has(key)) return { ok: false, error: 'tekrarlanan_sozlesme' };
    seen.add(key);
    const g = groups.get(taxId) ?? { taxId, name: r.name.trim(), taxOffice: r.taxOffice?.trim() ?? '', contracts: [] };
    g.contracts.push(r);
    groups.set(taxId, g);
  }
  return { ok: true, groups: [...groups.values()] };
}

/** Beyanname içe aktarımının erişim kanıtı: geçerli "Aracılık ve Sorumluluk" sözleşmesi (eski kurum incelemesi kuralı). */
export const isIntermediaryContract = (type: string | null | undefined) => /Aracılık.*Sorumluluk/iu.test(type ?? '');
