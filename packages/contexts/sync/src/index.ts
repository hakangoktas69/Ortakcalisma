// PUBLIC API — sync bağlamı: entegrasyon kaydı, taşıma yolu, iş planlama, istek bütçesi, iş/adım durumu, sonuç dağıtımı.
// Başka bağlamlar ve uygulamalar yalnız bu dosyadan içe aktarır (tools/arch). Ayrıntı: docs/baglamlar/sync.md
export const CONTEXT = 'sync' as const;

export { canTransition, isFinal, isStale, JOB_KINDS, JOB_PERMISSION, STATUS_LABEL, type JobKind, type JobStatus } from './domain/job.ts';
export {
  failStaleJobs,
  finishJob,
  getJob,
  latestJobs,
  recordProgress,
  requestCalendarJob,
  requestJob,
  type AccountRef,
  type Ctx,
  type Job,
  type JobRepository,
  type RequestError,
} from './application/jobs.ts';
export { PgJobRepository } from './infrastructure/pg-jobs.ts';
