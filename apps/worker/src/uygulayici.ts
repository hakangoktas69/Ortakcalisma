import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { recordLoginResult, type CredentialRepository } from '@eworks/credentials';
import { createFirmFromSource, firmsByTaxIds, refreshFirmFromSource, type FirmDeps } from '@eworks/portfolio';
import { finishJob, recordProgress, type JobRepository } from '@eworks/sync';
import { importFilingContracts, type ContractList, type ContractRepository, type FirmPort } from '@eworks/tax-filing';

// Entegrasyon sonucunu uygulayan işçi mantığı (06 §4: alan kuralları burada, Python ACL tablolara yazmaz).
// Bağlamlar yalnız public API'leriyle birleştirilir (bileşim kökü).

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sema = (ad: string) => JSON.parse(readFileSync(join(kok, 'contracts', ad), 'utf8')) as object;
const ajv = new Ajv2020({ allErrors: false, strict: true });
addFormats.default(ajv);
const sonucMesajiGecerli = ajv.compile(sema('events/integration.sonuc.v1.schema.json'));
const sozlesmeListesiGecerli = ajv.compile(sema('integration/eworks.gib.contracts.v1.schema.json'));

export type SonucMesaji = { orgId: string; jobId: string; outcome: 'ok' | 'wrong_password' | 'failed' | 'progress'; resultKey?: string; message?: string };
export type SozlesmeSonucu = ContractList & { schema: 'eworks.gib.contracts.v1'; jobId: string; sourceType: 'gib_live' | 'sahte_gib'; observedAt: string };

export type UygulayiciDeps = {
  jobs: JobRepository;
  creds: CredentialRepository;
  firmalar: FirmDeps;
  sozlesmeler: ContractRepository;
  sonucOku: (anahtar: string) => Promise<unknown>;
};

/** portfolio use-case'lerini tax-filing'in FirmPort'una bağlar. */
export const firmaPortu = (firmalar: FirmDeps): FirmPort => ({
  byTaxIds: async (ctx, ids) => (await firmsByTaxIds(ctx, ids, firmalar)).map((f) => ({ id: f.id, taxId: f.taxId, title: f.title, taxOffice: f.taxOffice, source: f.source })),
  create: async (ctx, s) => {
    const r = await createFirmFromSource(ctx, s, firmalar);
    return r.ok ? { ok: true, id: r.value.id } : { ok: false, error: r.error };
  },
  refresh: async (ctx, f, s) => {
    const firm = (await firmsByTaxIds(ctx, [f.taxId], firmalar))[0];
    return firm ? refreshFirmFromSource(ctx, firm, s, firmalar) : false;
  },
});

const LISTE_HATASI: Record<string, string> = {
  sayi_uyusmuyor: 'GİB toplamı ile okunan satır sayısı uyuşmadı; liste uygulanmadı.',
  kimlik_gecersiz: 'Listede geçersiz VKN/TCKN var; liste uygulanmadı.',
  eksik_alan: 'Listede eksik alan var; liste uygulanmadı.',
  tekrarlanan_sozlesme: 'Listede tekrarlanan sözleşme var; liste uygulanmadı.',
};

/** Tek bir sonuç mesajını işler. Geçersiz mesaj fırlatır (kuyruk ölü mektuba gönderir). İdempotent: kesinleşmiş iş tekrar değişmez. */
export async function sonucuIsle(ham: unknown, d: UygulayiciDeps): Promise<string> {
  if (!sonucMesajiGecerli(ham)) throw new Error('Sonuç mesajı şemaya uymuyor');
  const m = ham as SonucMesaji;
  const ctx = { org: m.orgId };
  if (m.outcome === 'progress') {
    await recordProgress(ctx, m.jobId, m.message ?? 'Çalışıyor.', d);
    return 'ilerleme';
  }
  const sahip = await d.jobs.accountOwner(ctx, m.jobId);
  if (!sahip) throw new Error('İş bulunamadı');
  if (m.outcome === 'wrong_password') {
    await recordLoginResult(ctx, sahip.accountId, 'wrong_password', d.creds);
    await finishJob(ctx, m.jobId, 'wrong_password', 'Kurum kullanıcı kodu veya şifresi hatalı. Hesap, yeni bilgi girilene dek kullanılmayacak.', d);
    return 'hatali_sifre';
  }
  if (m.outcome === 'failed') {
    await finishJob(ctx, m.jobId, 'failed', m.message ?? 'Kurum işi tamamlanamadı.', d);
    return 'basarisiz';
  }
  if (!m.resultKey || !m.resultKey.startsWith(`org/${m.orgId}/`)) throw new Error('Sonuç anahtarı ofisle eşleşmiyor');
  const sonuc = await d.sonucOku(m.resultKey);
  if (!sozlesmeListesiGecerli(sonuc) || (sonuc as SozlesmeSonucu).jobId !== m.jobId) {
    await finishJob(ctx, m.jobId, 'failed', 'Kurum sonucu beklenen biçimde değil; veri yazılmadı.', d);
    return 'gecersiz_sonuc';
  }
  if (sahip.ownerKind !== 'advisor') throw new Error('Sözleşme listesi müşavir hesabıyla okunur');
  await recordLoginResult(ctx, sahip.accountId, 'ok', d.creds);
  const s = sonuc as SozlesmeSonucu;
  const r = await importFilingContracts(ctx, { jobId: m.jobId, advisorId: sahip.ownerId, source: s.sourceType, list: s }, { firms: firmaPortu(d.firmalar), contracts: d.sozlesmeler });
  if (!r.ok) {
    await finishJob(ctx, m.jobId, 'failed', LISTE_HATASI[r.error] ?? 'Liste uygulanmadı.', d);
    return 'liste_hatasi';
  }
  const x = r.summary;
  const metin = `${x.sozlesme} sözleşme · ${x.mukellef} mükellef · ${x.yeni} yeni / ${x.eslesen} eşleşen${x.cakisan ? ` · ${x.cakisan} başka ofiste kayıtlı` : ''}${x.gecersiz ? ` · ${x.gecersiz} geçersiz kimlik` : ''}${s.sourceType === 'sahte_gib' ? ' · kaynak: sahte GİB (demo)' : ''}`;
  await finishJob(ctx, m.jobId, 'succeeded', metin, d, { ...x, kaynak: s.sourceType, gozlem: s.observedAt });
  return 'uygulandi';
}
