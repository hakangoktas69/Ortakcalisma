// Kurum hesabı türleri ve alanları (05 §4; Mert'in 26.10 kurum bilgi kartları). Alanların hepsi sırdır ve yalnız Vault'a gider;
// tabloda yalnız etiket (SGK işyeri adı) ve durum durur. SGK hesabı işyeri başınadır (e-Bildirge girişi işyeri bazında).
// e-Devlet şifresi bilinçli olarak yok: kişiye özeldir, başkasıyla paylaşılması kullanım koşullarına aykırıdır.

export type Institution = 'GIB' | 'SGK' | 'UETS';
export type OwnerKind = 'advisor' | 'firm';

export type FieldDef = { readonly name: string; readonly title: string; readonly secret: boolean; readonly max: number; readonly trim: boolean };
export type InstitutionForm = {
  readonly institution: Institution;
  readonly title: string;
  readonly owners: readonly OwnerKind[];
  /** Etiket zorunluysa bir sahibin bu kurumda birden çok hesabı olabilir (SGK: işyeri başına). */
  readonly labelRequired: boolean;
  readonly labelTitle?: string;
  readonly fields: readonly FieldDef[];
};

const ad = (name: string, title: string, max = 256): FieldDef => ({ name, title, secret: false, max, trim: true });
const sir = (name: string, title: string): FieldDef => ({ name, title, secret: true, max: 1024, trim: false });

export const INSTITUTION_FORMS: readonly InstitutionForm[] = [
  { institution: 'GIB', title: 'GİB', owners: ['advisor', 'firm'], labelRequired: false, fields: [ad('username', 'GİB kullanıcı kodu'), sir('password', 'GİB şifresi')] },
  {
    institution: 'SGK',
    title: 'SGK',
    owners: ['firm'],
    labelRequired: true,
    labelTitle: 'İşyeri adı',
    fields: [ad('username', 'SGK kullanıcı adı'), ad('workplaceCode', 'İşyeri kodu', 64), sir('systemPassword', 'Sistem şifresi'), sir('workplacePassword', 'İşyeri şifresi')],
  },
  { institution: 'UETS', title: 'UETS', owners: ['firm'], labelRequired: false, fields: [ad('address', 'UETS adresi'), sir('password', 'UETS şifresi')] },
];

export const LABEL_MAX = 80;

export type CredentialInput = { institution: string; ownerKind: string; label?: string; fields: Record<string, unknown> };
export type ValidCredential = { institution: Institution; ownerKind: OwnerKind; label: string; secret: Record<string, string> };
export type CredentialFieldError = { readonly alan: string; readonly mesaj: string };

/** Kurum ve sahip türüne göre alanları doğrular, normalleştirir. Hata yalnız alan adı ve sabit metindir (değer içermez). */
export function validateCredential(i: CredentialInput): { ok: true; value: ValidCredential } | { ok: false; errors: CredentialFieldError[] } {
  const form = INSTITUTION_FORMS.find((f) => f.institution === i.institution);
  if (!form) return { ok: false, errors: [{ alan: 'institution', mesaj: 'Bu kurum için hesap bilgisi saklanmıyor.' }] };
  const errors: CredentialFieldError[] = [];
  const ownerKind = form.owners.find((o) => o === i.ownerKind);
  if (!ownerKind) errors.push({ alan: 'ownerKind', mesaj: `${form.title} hesabı yalnız firma için girilir.` });
  const label = (i.label ?? '').trim().replace(/\s+/g, ' ');
  if (form.labelRequired && !label) errors.push({ alan: 'label', mesaj: `${form.labelTitle ?? 'Etiket'} gerekli.` });
  if (!form.labelRequired && label) errors.push({ alan: 'label', mesaj: 'Bu kurumda etiket kullanılmaz.' });
  if (label.length > LABEL_MAX) errors.push({ alan: 'label', mesaj: `En fazla ${LABEL_MAX} karakter olabilir.` });
  const bilinen = new Set(form.fields.map((f) => f.name));
  if (Object.keys(i.fields).some((k) => !bilinen.has(k))) errors.push({ alan: 'fields', mesaj: 'Tanınmayan alan gönderildi.' });
  const secret: Record<string, string> = {};
  for (const f of form.fields) {
    const ham = i.fields[f.name];
    const v = typeof ham === 'string' ? (f.trim ? ham.trim() : ham) : '';
    if (!v) errors.push({ alan: f.name, mesaj: `${f.title} gerekli.` });
    else if (v.length > f.max) errors.push({ alan: f.name, mesaj: `${f.title} en fazla ${f.max} karakter olabilir.` });
    else secret[f.name] = v;
  }
  if (errors.length > 0 || !ownerKind) return { ok: false, errors };
  return { ok: true, value: { institution: form.institution, ownerKind, label, secret } };
}
