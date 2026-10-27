import { describe, expect, it } from 'vitest';
import { importNotices, listNotices, type NoticeRepository, type StoredNotice, type ValidNotice } from '../../src/index.ts';

const ctx = { org: 'o-1' };
function depo() {
  const satir = new Map<string, StoredNotice>();
  const r: NoticeRepository = {
    upsert: async (_c, firmId, rows: readonly ValidNotice[], jobId) => {
      let yeni = 0;
      for (const x of rows) {
        const k = `${firmId}:${x.noticeKey}`;
        if (!satir.has(k)) yeni++;
        satir.set(k, { ...x, id: k, firmId, firmTitle: 'Firma', jobId });
      }
      return { yeni, guncellenen: rows.length - yeni };
    },
    list: async (_c, f) => [...satir.values()].filter((x) => !f.firmId || x.firmId === f.firmId),
  };
  return { r, satir };
}
const liste = (n: number) => ({
  count: n,
  accountVerified: true,
  documentsOpened: false,
  records: Array.from({ length: n }, (_, i) => ({
    noticeKey: i.toString(16).padStart(64, '0'),
    reference: `B-${i}`,
    documentType: 'Ödeme Emri',
    sender: 'VDB',
    department: '',
    sentOn: '2026-10-20',
    deliveredOn: null,
    readOn: null,
  })),
});

describe('e-Tebligat use-case\'leri', () => {
  it('[F:tebligat.liste.sync] doğrulanmış liste firmaya yazılır; ikinci kez aynı liste yeni kayıt açmaz', async () => {
    const d = depo();
    expect(await importNotices(ctx, { jobId: 'j-1', firmId: 'f-1', list: liste(3) }, d.r)).toEqual({ ok: true, value: { toplam: 3, yeni: 3, guncellenen: 0 } });
    expect(await importNotices(ctx, { jobId: 'j-2', firmId: 'f-1', list: liste(3) }, d.r)).toEqual({ ok: true, value: { toplam: 3, yeni: 0, guncellenen: 3 } });
    expect((await listNotices({ sub: 'u', org: 'o-1' }, { firmId: 'f-1' }, d.r)).length).toBe(3);
  });

  it('doğrulanamayan liste hiçbir kayıt yazmaz', async () => {
    const d = depo();
    expect(await importNotices(ctx, { jobId: 'j-1', firmId: 'f-1', list: { ...liste(2), count: 5 } }, d.r)).toEqual({ ok: false, error: 'sayi_uyusmuyor' });
    expect(d.satir.size).toBe(0);
  });
});
