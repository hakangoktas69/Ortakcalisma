import { err, ok, type Result } from './result.ts';

// VKN (10 hane, GİB algoritması) veya TCKN (11 hane, kontrol haneli). Paylaşılan çekirdek: tüm bağlamlar aynı kuralı kullanır.
export type TaxId = { readonly kind: 'VKN' | 'TCKN'; readonly value: string };

export function isValidVkn(v: string): boolean {
  if (!/^\d{10}$/.test(v)) return false;
  const d = [...v].map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const t = ((d[i] ?? 0) + 10 - (i + 1)) % 10;
    const p = t === 0 ? 0 : (t * 2 ** (10 - (i + 1))) % 9 || 9;
    sum += p;
  }
  return (10 - (sum % 10)) % 10 === d[9];
}

export function isValidTckn(v: string): boolean {
  if (!/^[1-9]\d{10}$/.test(v)) return false;
  const d = [...v].map(Number) as number[];
  const at = (i: number) => d[i] ?? 0;
  const d10 = (((at(0) + at(2) + at(4) + at(6) + at(8)) * 7 - (at(1) + at(3) + at(5) + at(7))) % 10 + 10) % 10;
  const d11 = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return at(9) === d10 && at(10) === d11;
}

export function parseTaxId(input: string): Result<TaxId, 'gecersiz_vergi_kimligi'> {
  const v = input.trim();
  if (v.length === 10 && isValidVkn(v)) return ok({ kind: 'VKN', value: v });
  if (v.length === 11 && isValidTckn(v)) return ok({ kind: 'TCKN', value: v });
  return err('gecersiz_vergi_kimligi');
}

/** Ekranda ve kayıtta kişisel veri maskesi: yalnız son 4 hane görünür. */
export const maskTaxId = (id: TaxId): string => '*'.repeat(id.value.length - 4) + id.value.slice(-4);
