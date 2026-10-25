// Belge (Document): kurumdan alınmış PDF'in metaverisi. Dosya içerik özetiyle adreslenir; saklama süresi (D15) dolunca
// dosya silinir, satır kalır. Kurallar eski robotun declaration_documents / portalın checkedAttachments denetiminden.

export const DOCUMENT_KINDS = ['declaration', 'tax_accrual', 'sgk_accrual', 'sgk_service'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const KIND_LABEL: Readonly<Record<DocumentKind, string>> = {
  declaration: 'Beyanname',
  tax_accrual: 'Vergi tahakkuku',
  sgk_accrual: 'SGK tahakkuku',
  sgk_service: 'SGK hizmet listesi',
};

export const MIN_SIZE = 100;
export const MAX_SIZE = 20 * 1024 * 1024;
export const DEFAULT_RETENTION_DAYS = 7;

/** Ofise ait belge anahtarı: org/<ofis>/belgeler/<sha256>.pdf — başka ofisin ya da başka biçimin anahtarı kabul edilmez. */
export const storageKey = (org: string, sha256: string) => `org/${org}/belgeler/${sha256}.pdf`;

export type NewDocument = { kind: string; key: string; sha256: string; size: number };

export function validDocument(org: string, d: NewDocument): d is NewDocument & { kind: DocumentKind } {
  return (
    (DOCUMENT_KINDS as readonly string[]).includes(d.kind) &&
    /^[0-9a-f]{64}$/.test(d.sha256) &&
    Number.isInteger(d.size) &&
    d.size >= MIN_SIZE &&
    d.size <= MAX_SIZE &&
    d.key === storageKey(org, d.sha256)
  );
}

/** Saklama süresi: en az 1, en çok 3650 gün; geçersizse varsayılan. */
export const retentionDays = (raw: string | undefined) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : DEFAULT_RETENTION_DAYS;
};

/** İndirilen dosya adı: kişisel veri içermez (VKN/unvan yok). */
export const downloadName = (kind: DocumentKind, type: string, period: string) =>
  `${type}-${period}-${kind === 'declaration' ? 'beyanname' : kind === 'tax_accrual' ? 'tahakkuk' : kind === 'sgk_accrual' ? 'sgk-tahakkuk' : 'hizmet-listesi'}.pdf`.replace(
    /[^A-Za-z0-9._-]/g,
    '-',
  );
