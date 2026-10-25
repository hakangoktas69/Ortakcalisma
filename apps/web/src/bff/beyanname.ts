import 'server-only';
import { getFirm } from '@eworks/portfolio';
import { istanbulDay, isIntermediaryContract, listFilingContracts } from '@eworks/tax-filing';
import { konteyner } from './konteyner.ts';

type Ctx = { sub: string; org: string };

/** Bugün (İstanbul). */
export const bugun = () => istanbulDay(new Date().toISOString())!;

/** Beyanname sorgulanabilecek (Aracılık ve Sorumluluk sözleşmeli) mükellefler — kurum incelemesi kuralı, kullanıcı kapsamında. */
export async function sozlesmeliFirmalar(ctx: Ctx) {
  const sozlesmeler = await listFilingContracts(ctx, konteyner().sozlesmeler);
  const uygun = new Map<string, { id: string; ad: string; taxId: string; numaralar: string[] }>();
  for (const s of sozlesmeler) {
    if (!isIntermediaryContract(s.contractType)) continue;
    const f = uygun.get(s.firmId) ?? { id: s.firmId, ad: s.firmTitle, taxId: s.taxId, numaralar: [] };
    f.numaralar.push(s.number);
    uygun.set(s.firmId, f);
  }
  return { sozlesmeler, uygun };
}

/** Senkron kapsamındaki tek firma: kullanıcı görebilmeli ve Aracılık ve Sorumluluk sözleşmesi olmalı. */
export async function kapsamFirmasi(ctx: Ctx, firmaId: string) {
  const f = await getFirm(ctx, firmaId, konteyner().firmalar);
  if (!f) return null;
  const { uygun } = await sozlesmeliFirmalar(ctx);
  return uygun.get(f.id) ?? null;
}
