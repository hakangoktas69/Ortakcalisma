import { parseTaxId } from '@eworks/kernel';

// Mükellef (firma) kartı kuralları. Alanlar ve seçenekler eski portalın firma formundan (eski/mert/eworks …/eworks-tasarim.html,
// editFirm) gelir; yeni modelde her firmanın tek müşaviri vardır (D16).

export const FIRM_KINDS = ['Limited', 'Anonim', 'Şahıs', 'Esnaf', 'Serbest Meslek', 'Belirtilmedi'] as const;
export const TAX_REGIMES = ['Belirtilmedi', 'Gerçek Usul', 'Basit Usul'] as const;
export const FIRM_STATUSES = ['Onay Bekliyor', 'Aktif', 'Pasif'] as const;

export type FirmKind = (typeof FIRM_KINDS)[number];
export type TaxRegime = (typeof TAX_REGIMES)[number];
export type FirmStatus = (typeof FIRM_STATUSES)[number];

export type FirmInput = {
  title: string;
  kind: string;
  taxId: string;
  taxOffice?: string;
  city?: string;
  representative?: string;
  phone?: string;
  email?: string;
  activityCode?: string;
  activityName?: string;
  taxRegime?: string;
  status?: string;
  groupName?: string;
};

export type ValidFirm = {
  title: string;
  kind: FirmKind;
  taxId: string;
  taxIdKind: 'VKN' | 'TCKN';
  taxOffice: string | null;
  city: string | null;
  representative: string | null;
  phone: string | null;
  email: string | null;
  activityCode: string | null;
  activityName: string | null;
  taxRegime: TaxRegime;
  status: FirmStatus;
  groupName: string | null;
};

export type FirmFieldError = { readonly alan: keyof FirmInput; readonly mesaj: string };

const bos = (v: string | undefined, max: number) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t.slice(0, max);
};
const icinde = <T extends string>(liste: readonly T[], v: string | undefined, varsayilan: T): T | undefined =>
  v === undefined || v === '' ? varsayilan : (liste as readonly string[]).includes(v) ? (v as T) : undefined;

/** Kartı doğrular ve normalleştirir; hatalar alan bazında Türkçe döner (kişisel veri içermez). */
export function validateFirm(input: FirmInput): { ok: true; value: ValidFirm } | { ok: false; errors: FirmFieldError[] } {
  const errors: FirmFieldError[] = [];
  const title = input.title.trim().replace(/\s+/g, ' ');
  if (!title) errors.push({ alan: 'title', mesaj: 'Unvan gerekli.' });
  if (title.length > 300) errors.push({ alan: 'title', mesaj: 'Unvan en fazla 300 karakter olabilir.' });
  const kind = icinde(FIRM_KINDS, input.kind, 'Belirtilmedi');
  if (!kind) errors.push({ alan: 'kind', mesaj: 'Firma türü geçersiz.' });
  const tax = parseTaxId(input.taxId.replace(/\s/g, ''));
  if (!tax.ok) errors.push({ alan: 'taxId', mesaj: 'VKN (10 hane) ya da TCKN (11 hane) geçersiz.' });
  else if ((kind === 'Limited' || kind === 'Anonim') && tax.value.kind !== 'VKN') errors.push({ alan: 'taxId', mesaj: 'Sermaye şirketi için VKN gerekli.' });
  const email = bos(input.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push({ alan: 'email', mesaj: 'E-posta biçimi geçersiz.' });
  const phone = bos(input.phone, 40);
  if (phone && !/^[+()\d\s-]{7,40}$/.test(phone)) errors.push({ alan: 'phone', mesaj: 'Telefon biçimi geçersiz.' });
  const taxRegime = icinde(TAX_REGIMES, input.taxRegime, 'Belirtilmedi');
  if (!taxRegime) errors.push({ alan: 'taxRegime', mesaj: 'Vergilendirme usulü geçersiz.' });
  const status = icinde(FIRM_STATUSES, input.status, 'Onay Bekliyor');
  if (!status) errors.push({ alan: 'status', mesaj: 'Onay durumu geçersiz.' });
  if (errors.length > 0 || !kind || !tax.ok || !taxRegime || !status) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      kind,
      taxId: tax.value.value,
      taxIdKind: tax.value.kind,
      taxOffice: bos(input.taxOffice, 120),
      city: bos(input.city, 80),
      representative: bos(input.representative, 160),
      phone,
      email,
      activityCode: bos(input.activityCode, 20),
      activityName: bos(input.activityName, 300),
      taxRegime,
      status,
      groupName: bos(input.groupName, 120),
    },
  };
}

/** Eski portaldaki segmentler: onaylanmış/onay bekleyen, basit usul, kurumsal/şahıs. */
export type Segment = 'all' | 'approved' | 'pending' | 'simple' | 'corporate' | 'personal';
export const firmCategory = (kind: FirmKind) => (kind === 'Limited' || kind === 'Anonim' ? 'corporate' : 'personal');
export const isApproved = (status: FirmStatus) => status === 'Aktif';
export function inSegment(f: { kind: FirmKind; status: FirmStatus; taxRegime: TaxRegime }, s: Segment): boolean {
  if (s === 'all') return true;
  if (s === 'approved') return isApproved(f.status);
  if (s === 'pending') return !isApproved(f.status);
  if (s === 'simple') return f.taxRegime === 'Basit Usul';
  return firmCategory(f.kind) === s;
}
