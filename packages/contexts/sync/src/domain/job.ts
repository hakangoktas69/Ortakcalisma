// Kurum işi (SyncJob, 02 §5): tür, durum makinesi, kullanıcıya gösterilen sabit metinler.
// Durum geçişleri: queued → running → succeeded | failed | wrong_password; queued → cancelled. Sonuç durumları kesindir.

export const JOB_KINDS = ['gib.sozlesmeler', 'gib.beyannameler', 'gib.muhsgk', 'takvim.kaynaklar'] as const;
export type JobKind = (typeof JOB_KINDS)[number];
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'wrong_password' | 'cancelled';

/** İşi başlatmak için gereken yetki anahtarı (05 §3, feature-registry). */
export const JOB_PERMISSION: Readonly<Record<JobKind, string>> = {
  'gib.sozlesmeler': 'firmalar.gib_sozlesmeler.sync',
  'gib.beyannameler': 'beyanname.senkron.start',
  // MUHSGK + SGK bildirimleri (SGK tahakkuk, hizmet listesi) — e-Bildirge toplu güncelleme
  'gib.muhsgk': 'sgk.ebildirge.sync',
  // Takvim kaynakları: kamuya açık GİB vergi takvimi + Nager.Date tatilleri; kurum hesabı kullanmaz
  'takvim.kaynaklar': 'genel_bakis.takvim.sync',
};

export const isFinal = (s: JobStatus) => s === 'succeeded' || s === 'failed' || s === 'wrong_password' || s === 'cancelled';

const GECIS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ['running', 'cancelled', 'failed'],
  running: ['succeeded', 'failed', 'wrong_password'],
  succeeded: [],
  failed: [],
  wrong_password: [],
  cancelled: [],
};
export const canTransition = (from: JobStatus, to: JobStatus) => GECIS[from].includes(to);

export const STATUS_LABEL: Readonly<Record<JobStatus, string>> = {
  queued: 'Sırada',
  running: 'Çalışıyor',
  succeeded: 'Tamamlandı',
  failed: 'Başarısız',
  wrong_password: 'Kurum şifresi hatalı',
  cancelled: 'İptal edildi',
};

/** Takılı kalan iş: belirtilen süreden uzun "running" durumunda (işçi çökmüş olabilir). */
export const isStale = (startedAt: Date | null, now: Date, limitMinutes = 20) => startedAt !== null && now.getTime() - startedAt.getTime() > limitMinutes * 60_000;
