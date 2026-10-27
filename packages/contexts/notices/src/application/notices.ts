import { ok, type Result } from '@eworks/kernel';
import { validateNoticeList, type NoticeList, type NoticeListError, type ValidNotice } from '../domain/notice.ts';

// e-Tebligat use-case'leri. Yazma yalnız işçinin sistem bağlamında (ACL sonucu); okuma firma kapsamında (RLS: ofis personeli ve
// mükellef kendi firması). Liste tekrar alınınca kayıtlar güncellenir, yinelenmez.

export type Ctx = { readonly sub?: string; readonly org: string };
export type StoredNotice = ValidNotice & { id: string; firmId: string; firmTitle: string | null; jobId: string };

export interface NoticeRepository {
  upsert(ctx: Ctx, firmId: string, rows: readonly ValidNotice[], jobId: string): Promise<{ yeni: number; guncellenen: number }>;
  list(ctx: Ctx, f: { firmId?: string }): Promise<StoredNotice[]>;
}

export async function importNotices(
  ctx: Ctx,
  i: { jobId: string; firmId: string; list: NoticeList },
  repo: NoticeRepository,
): Promise<Result<{ toplam: number; yeni: number; guncellenen: number }, NoticeListError>> {
  const v = validateNoticeList(i.list);
  if (!v.ok) return v;
  const r = await repo.upsert(ctx, i.firmId, v.value, i.jobId);
  return ok({ toplam: v.value.length, ...r });
}

export const listNotices = (ctx: Ctx, f: { firmId?: string }, repo: NoticeRepository) => repo.list(ctx, f);
