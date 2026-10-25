import { describe, expect, it } from 'vitest';
import { failStaleJobs, finishJob, recordProgress, requestJob, type Job, type JobRepository, type JobStatus } from '../../src/index.ts';

const ctx = { sub: 'u-1', org: 'o-1' };
const hesap = { id: 'h-1', status: 'active' as const };

function depo(baslangic: Job[] = []) {
  const isler = new Map(baslangic.map((j) => [j.id, j]));
  const outbox: string[] = [];
  const r: JobRepository = {
    activeFor: async (_c, kind, accountId) => [...isler.values()].find((j) => j.kind === kind && j.accountId === accountId && (j.status === 'queued' || j.status === 'running')) ?? null,
    insertWithOutbox: async (_c, j) => {
      isler.set(j.id, { id: j.id, kind: j.kind, accountId: j.accountId, status: 'queued', statusMessage: null, resultSummary: null, createdAt: '', startedAt: null, finishedAt: null });
      outbox.push(j.id);
    },
    get: async (_c, id) => isler.get(id) ?? null,
    latest: async () => [...isler.values()],
    setStatus: async (_c, id, from, to, message, summary) => {
      const j = isler.get(id);
      if (!j || !from.includes(j.status)) return false;
      isler.set(id, { ...j, status: to, statusMessage: message, resultSummary: summary ?? j.resultSummary });
      return true;
    },
    setMessage: async (_c, id, message) => {
      const j = isler.get(id);
      if (j) isler.set(id, { ...j, statusMessage: message });
    },
    accountOwner: async () => null,
    staleRunning: async () => [...isler.values()].filter((j) => j.status === 'running').map((j) => j.id),
  };
  return { r, isler, outbox };
}

let n = 0;
const newId = () => `j-${++n}`;

describe('kurum işi isteme', () => {
  it('iş ve outbox mesajı birlikte yazılır', async () => {
    const { r, outbox } = depo();
    const s = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, { jobs: r, newId });
    expect(s.ok && s.value.existing).toBe(false);
    expect(outbox).toHaveLength(1);
  });

  it('aynı hesapta süren iş varsa yenisi açılmaz', async () => {
    const { r, outbox } = depo();
    const a = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, { jobs: r, newId });
    const b = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: hesap }, { jobs: r, newId });
    expect(a.ok && b.ok && a.value.jobId === b.value.jobId && b.value.existing).toBe(true);
    expect(outbox).toHaveLength(1);
  });

  it('hesap yoksa, şifresi hatalıysa ya da oturum yoksa kuyruğa hiçbir şey gitmez', async () => {
    const { r, outbox } = depo();
    const d = { jobs: r, newId };
    expect(await requestJob(ctx, { kind: 'gib.sozlesmeler', account: null }, d)).toEqual({ ok: false, error: 'hesap_yok' });
    expect(await requestJob(ctx, { kind: 'gib.sozlesmeler', account: { id: 'h', status: 'wrong_password' } }, d)).toEqual({ ok: false, error: 'hesap_hatali_sifre' });
    expect(await requestJob(ctx, { kind: 'gib.sozlesmeler', account: { id: 'h', status: 'locked' } }, d)).toEqual({ ok: false, error: 'hesap_kullanilamaz' });
    expect(await requestJob({ org: 'o-1' }, { kind: 'gib.sozlesmeler', account: hesap }, d)).toEqual({ ok: false, error: 'oturum_yok' });
    expect(outbox).toEqual([]);
  });
});

describe('kurum işi sonuçlandırma', () => {
  const is = (status: JobStatus): Job => ({ id: 'j', kind: 'gib.sozlesmeler', accountId: 'h-1', status, statusMessage: null, resultSummary: null, createdAt: '', startedAt: null, finishedAt: null });

  it('çalışan iş bir kez sonuçlanır; tekrar gelen sonuç etkisizdir', async () => {
    const { r, isler } = depo([is('running')]);
    expect(await finishJob(ctx, 'j', 'succeeded', 'tamam', { jobs: r }, { yeni: 1 })).toBe(true);
    expect(await finishJob(ctx, 'j', 'failed', 'geç', { jobs: r })).toBe(false);
    expect(isler.get('j')).toMatchObject({ status: 'succeeded', statusMessage: 'tamam', resultSummary: { yeni: 1 } });
  });

  it('sırada bekleyen iş başarısız sayılabilir ama başarılı sayılamaz', async () => {
    const { r } = depo([is('queued')]);
    expect(await finishJob(ctx, 'j', 'succeeded', 'x', { jobs: r })).toBe(false);
    expect(await finishJob(ctx, 'j', 'failed', 'x', { jobs: r })).toBe(true);
  });

  it('ilerleme metni kısaltılır; takılı işler başarısız sayılır', async () => {
    const { r, isler } = depo([is('running')]);
    await recordProgress(ctx, 'j', 'x'.repeat(900), { jobs: r });
    expect(isler.get('j')?.statusMessage).toHaveLength(500);
    expect(await failStaleJobs({ org: 'o-1' }, { jobs: r })).toBe(1);
    expect(isler.get('j')?.status).toBe('failed');
  });
});
