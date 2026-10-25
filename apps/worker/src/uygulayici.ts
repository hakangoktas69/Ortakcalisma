import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { recordLoginResult, type CredentialRepository } from '@eworks/credentials';
import { registerDocuments, type DocumentRepository } from '@eworks/documents';
import { createFirmFromSource, firmsByTaxIds, refreshFirmFromSource, type FirmDeps } from '@eworks/portfolio';
import { importFilings, type FilingRepository, type SgkFilingRecord } from '@eworks/social-security';
import { finishJob, recordProgress, type JobRepository } from '@eworks/sync';
import {
  declarationSummaryText,
  importDeclarations,
  importFilingContracts,
  type ContractList,
  type ContractRepository,
  type DeclarationQuery,
  type DeclarationRepository,
  type DocumentPort,
  type FirmPort,
  type ImportSummary,
} from '@eworks/tax-filing';

// Entegrasyon sonucunu uygulayan işçi mantığı (06 §4: alan kuralları burada, Python ACL tablolara yazmaz).
// Bağlamlar yalnız public API'leriyle birleştirilir (bileşim kökü).

const kok = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sema = (ad: string) => JSON.parse(readFileSync(join(kok, 'contracts', ad), 'utf8')) as object;
const ajv = new Ajv2020({ allErrors: false, strict: true });
addFormats.default(ajv);
const sonucMesajiGecerli = ajv.compile(sema('events/integration.sonuc.v1.schema.json'));
const sozlesmeListesiGecerli = ajv.compile(sema('integration/eworks.gib.contracts.v1.schema.json'));
const beyannameSonucuGecerli = ajv.compile(sema('integration/eworks.gib.declarations.v1.schema.json'));

export type SonucMesaji = { orgId: string; jobId: string; outcome: 'ok' | 'wrong_password' | 'failed' | 'progress'; resultKey?: string; message?: string };
type Kaynak = 'gib_live' | 'sahte_gib';
export type SozlesmeSonucu = ContractList & { schema: 'eworks.gib.contracts.v1'; jobId: string; sourceType: Kaynak; observedAt: string };
export type BeyannameSonucu = {
  schema: 'eworks.gib.declarations.v1';
  jobId: string;
  sourceType: Kaynak;
  observedAt: string;
  contracts: ContractList;
  scope: { startDate: string; endDate: string };
  queries: DeclarationQuery[];
};

export type UygulayiciDeps = {
  jobs: JobRepository;
  creds: CredentialRepository;
  firmalar: FirmDeps;
  sozlesmeler: ContractRepository;
  beyannameler: DeclarationRepository;
  belgeler: DocumentRepository;
  sgk: FilingRepository;
  sonucOku: (anahtar: string) => Promise<unknown>;
  /** Uygulanan ham sonuç silinir (02 §9: ham sonuç saklanmaz); silinemezse iş yine tamamlanır. */
  sonucSil: (anahtar: string) => Promise<void>;
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

/** documents use-case'ini tax-filing'in DocumentPort'una bağlar. */
export const belgePortu = (repo: DocumentRepository): DocumentPort => ({
  register: (ctx, docs) => registerDocuments(ctx, docs, { repo }),
});

const LISTE_HATASI: Record<string, string> = {
  sayi_uyusmuyor: 'GİB toplamı ile okunan satır sayısı uyuşmadı; liste uygulanmadı.',
  kimlik_gecersiz: 'Listede geçersiz VKN/TCKN var; liste uygulanmadı.',
  eksik_alan: 'Listede eksik alan var; liste uygulanmadı.',
  tekrarlanan_sozlesme: 'Listede tekrarlanan sözleşme var; liste uygulanmadı.',
};

const sozlesmeMetni = (x: ImportSummary, kaynak: Kaynak) =>
  `${x.sozlesme} sözleşme · ${x.mukellef} mükellef · ${x.yeni} yeni / ${x.eslesen} eşleşen${x.cakisan ? ` · ${x.cakisan} başka ofiste kayıtlı` : ''}${x.gecersiz ? ` · ${x.gecersiz} geçersiz kimlik` : ''}${kaynak === 'sahte_gib' ? ' · kaynak: sahte GİB (demo)' : ''}`;

/** Tek bir sonuç mesajını işler. Geçersiz mesaj fırlatır (kuyruk ölü mektuba gönderir). İdempotent: kesinleşmiş iş tekrar değişmez. */
export async function sonucuIsle(ham: unknown, d: UygulayiciDeps): Promise<string> {
  if (!sonucMesajiGecerli(ham)) throw new Error('Sonuç mesajı şemaya uymuyor');
  const m = ham as SonucMesaji;
  const ctx = { org: m.orgId };
  if (m.outcome === 'progress') {
    await recordProgress(ctx, m.jobId, m.message ?? 'Çalışıyor.', d);
    return 'ilerleme';
  }
  const [sahip, is] = await Promise.all([d.jobs.accountOwner(ctx, m.jobId), d.jobs.get(ctx, m.jobId)]);
  if (!sahip || !is) throw new Error('İş bulunamadı');
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
  try {
    return is.kind === 'gib.beyannameler' || is.kind === 'gib.muhsgk' ? await beyannameUygula(ctx, m, sonuc, sahip, d) : await sozlesmeUygula(ctx, m, sonuc, sahip, d);
  } finally {
    await d.sonucSil(m.resultKey).catch(() => {});
  }
}

type Sahip = { accountId: string; ownerKind: 'advisor' | 'firm'; ownerId: string };

async function sozlesmeUygula(ctx: { org: string }, m: SonucMesaji, sonuc: unknown, sahip: Sahip, d: UygulayiciDeps) {
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
  await finishJob(ctx, m.jobId, 'succeeded', sozlesmeMetni(r.summary, s.sourceType), d, { ...r.summary, kaynak: s.sourceType, gozlem: s.observedAt });
  return 'uygulandi';
}

/** Beyanname sonucu: önce aynı oturumun sözleşme listesi (firmalar + erişim kanıtı), sonra sorgu sonuçları ve belgeler. */
async function beyannameUygula(ctx: { org: string }, m: SonucMesaji, sonuc: unknown, sahip: Sahip, d: UygulayiciDeps) {
  if (!beyannameSonucuGecerli(sonuc) || (sonuc as BeyannameSonucu).jobId !== m.jobId) {
    await finishJob(ctx, m.jobId, 'failed', 'Kurum sonucu beklenen biçimde değil; veri yazılmadı.', d);
    return 'gecersiz_sonuc';
  }
  if (sahip.ownerKind !== 'advisor') throw new Error('Beyanname listesi müşavir hesabıyla okunur');
  await recordLoginResult(ctx, sahip.accountId, 'ok', d.creds);
  const s = sonuc as BeyannameSonucu;
  const k = await importFilingContracts(ctx, { jobId: m.jobId, advisorId: sahip.ownerId, source: s.sourceType, list: s.contracts }, { firms: firmaPortu(d.firmalar), contracts: d.sozlesmeler });
  if (!k.ok) {
    // Erişim kanıtı (sözleşme listesi) doğrulanmadıysa hiçbir beyanname uygulanmaz
    await finishJob(ctx, m.jobId, 'failed', LISTE_HATASI[k.error] ?? 'Sözleşme listesi uygulanmadı; beyannameler yazılmadı.', d);
    return 'liste_hatasi';
  }
  const sgk = { bildirim: 0, belge: 0, gecersiz: 0 };
  const x = await importDeclarations(
    ctx,
    { jobId: m.jobId, source: s.sourceType, contracts: s.contracts.contracts, queries: s.queries },
    {
      firms: firmaPortu(d.firmalar),
      declarations: d.beyannameler,
      documents: belgePortu(d.belgeler),
      // MUHSGK'nın SGK bildirimleri social-security bağlamına (beyanname kanıtla kabul edildikten sonra)
      onSaved: async (firmId, declarationId, r) => {
        if (r.type !== 'MUHSGK' || !r.sgk?.length) return;
        const t = await importFilings(
          ctx,
          { firmId, declarationId, parent: r, rows: r.sgk as SgkFilingRecord[], source: s.sourceType, jobId: m.jobId },
          { filings: d.sgk, documents: { register: (c, docs) => registerDocuments(c, docs.map((z) => ({ ...z, subjectKind: 'sgk_filing' as const })), { repo: d.belgeler }) } },
        );
        sgk.bildirim += t.bildirim;
        sgk.belge += t.belge;
        sgk.gecersiz += t.gecersiz;
      },
    },
  );
  const metin = `${declarationSummaryText(x, s.sourceType)}${sgk.bildirim ? ` · ${sgk.bildirim} SGK bildirimi (${sgk.belge} belge)` : ''}${sgk.gecersiz ? ` · ${sgk.gecersiz} SGK listesi doğrulanamadı` : ''}`;
  await finishJob(ctx, m.jobId, 'succeeded', metin.slice(0, 500), d, { ...x, sgk, kaynak: s.sourceType, gozlem: s.observedAt, kapsam: s.scope });
  return 'uygulandi';
}
