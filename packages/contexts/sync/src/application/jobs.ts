import { err, ok, type Result } from '@eworks/kernel';
import { canTransition, type JobKind, type JobStatus } from '../domain/job.ts';

// İş isteme, izleme ve sonuçlandırma. İş kaydı ve outbox mesajı aynı işlemde yazılır (transactional outbox):
// iş ya kuyruğa da gider ya hiç yazılmaz. Aynı hesapta aynı türde süren iş varsa yenisi açılmaz, mevcut iş döner.

export type Ctx = { readonly sub?: string; readonly org: string };

export type Job = {
  id: string;
  kind: JobKind;
  /** Kamuya açık kaynak işinde (takvim.kaynaklar) yok. */
  accountId: string | null;
  status: JobStatus;
  statusMessage: string | null;
  resultSummary: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export interface JobRepository {
  /** Süren iş; params verilirse iş parametreleri onları içermeli (takvim işinde yıl). */
  activeFor(ctx: Ctx, kind: JobKind, accountId: string | null, params?: Record<string, string | number>): Promise<Job | null>;
  /** İş + outbox (topic robot.<kurum>) tek işlemde. */
  insertWithOutbox(ctx: Ctx, job: { id: string; kind: JobKind; accountId: string | null; requestedBy: string | null; params: Record<string, unknown> }): Promise<void>;
  get(ctx: Ctx, id: string): Promise<Job | null>;
  latest(ctx: Ctx, kind: JobKind, limit: number): Promise<Job[]>;
  setStatus(ctx: Ctx, id: string, from: JobStatus[], to: JobStatus, message: string | null, summary?: Record<string, unknown>): Promise<boolean>;
  setMessage(ctx: Ctx, id: string, message: string): Promise<void>;
  /** İşin kurum hesabının sahibi (müşavir/firma) — sonuç uygulanırken portföy bağlamı için. */
  accountOwner(ctx: Ctx, id: string): Promise<{ accountId: string; ownerKind: 'advisor' | 'firm'; ownerId: string } | null>;
  staleRunning(ctx: Ctx, olderThanMinutes: number): Promise<string[]>;
  /** Verilen andan sonra açılmış, parametreleri eşleşen iş sayısı (işçinin günlük tekrar sınırı). */
  countSince(ctx: Ctx, kind: JobKind, sinceIso: string, params: Record<string, string | number>): Promise<number>;
}

/** İşin kullanacağı kurum hesabı (müşavirin ya da firmanın) — credentials/portfolio bağlamlarından gelir. */
export type AccountRef = { id: string; status: 'active' | 'wrong_password' | 'locked' | 'disabled' };

export type RequestError = 'hesap_yok' | 'hesap_hatali_sifre' | 'hesap_kullanilamaz' | 'oturum_yok';

export async function requestJob(
  ctx: Ctx,
  input: { kind: JobKind; account: AccountRef | null; params?: Record<string, unknown> },
  d: { jobs: JobRepository; newId: () => string },
): Promise<Result<{ jobId: string; existing: boolean }, RequestError>> {
  if (!ctx.sub) return err('oturum_yok');
  if (!input.account) return err('hesap_yok');
  if (input.account.status === 'wrong_password') return err('hesap_hatali_sifre');
  if (input.account.status !== 'active') return err('hesap_kullanilamaz');
  const active = await d.jobs.activeFor(ctx, input.kind, input.account.id);
  if (active) return ok({ jobId: active.id, existing: true });
  const id = d.newId();
  await d.jobs.insertWithOutbox(ctx, { id, kind: input.kind, accountId: input.account.id, requestedBy: ctx.sub, params: input.params ?? {} });
  return ok({ jobId: id, existing: false });
}

/**
 * Takvim kaynakları işi (kamuya açık GİB vergi takvimi + Nager.Date): kurum hesabı kullanmaz. Kullanıcı ister (genel_bakis.takvim.sync)
 * ya da işçi, GİB verisi eksik yıl için kendiliğinden ister (sistem bağlamı; aynı yıl için günde en çok bir kez). Süren iş varsa aynısı döner.
 */
export async function requestCalendarJob(
  ctx: Ctx,
  year: number,
  d: { jobs: JobRepository; newId: () => string },
  now: Date,
): Promise<Result<{ jobId: string; existing: boolean }, 'gecersiz_yil' | 'yakin_zamanda'>> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return err('gecersiz_yil');
  const active = await d.jobs.activeFor(ctx, 'takvim.kaynaklar', null, { year });
  if (active) return ok({ jobId: active.id, existing: true });
  if (!ctx.sub && (await d.jobs.countSince(ctx, 'takvim.kaynaklar', new Date(now.getTime() - 86_400_000).toISOString(), { year })) > 0) return err('yakin_zamanda');
  const id = d.newId();
  await d.jobs.insertWithOutbox(ctx, { id, kind: 'takvim.kaynaklar', accountId: null, requestedBy: ctx.sub ?? null, params: { year } });
  return ok({ jobId: id, existing: false });
}

export const getJob = (ctx: Ctx, id: string, d: { jobs: JobRepository }) => d.jobs.get(ctx, id);
export const latestJobs = (ctx: Ctx, kind: JobKind, d: { jobs: JobRepository }, limit = 5) => d.jobs.latest(ctx, kind, limit);

/** İşçi: entegrasyondan gelen ilerleme metni (sabit Türkçe metin; kurum yanıtı yazılmaz). */
export const recordProgress = (ctx: Ctx, id: string, message: string, d: { jobs: JobRepository }) => d.jobs.setMessage(ctx, id, message.slice(0, 500));

/** İşçi: sonucu kesinleştirir; durum makinesine aykırı geçiş (ör. ikinci kez sonuç) etkisizdir. */
export async function finishJob(ctx: Ctx, id: string, to: Extract<JobStatus, 'succeeded' | 'failed' | 'wrong_password'>, message: string, d: { jobs: JobRepository }, summary?: Record<string, unknown>) {
  const from = (['queued', 'running'] as JobStatus[]).filter((s) => canTransition(s, to));
  return d.jobs.setStatus(ctx, id, from, to, message.slice(0, 500), summary);
}

/** İşçi: takılı kalan (son ilerlemesinden beri sessiz) işleri başarısız sayar; çöken robot işi sonsuza dek "çalışıyor" görünmesin. */
export async function failStaleJobs(ctx: Ctx, d: { jobs: JobRepository }, limitMinutes = 20) {
  const ids = await d.jobs.staleRunning(ctx, limitMinutes);
  for (const id of ids) await d.jobs.setStatus(ctx, id, ['running'], 'failed', 'İş zaman aşımına uğradı; yeniden başlatın.');
  return ids.length;
}
