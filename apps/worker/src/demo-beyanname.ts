// Demo verisi — beyanname, SGK ve GİB sözleşmeleri: demo/geliştirme kipinde /beyanname/*, /sgk/* ve
// /firmalar/gib_sozlesmeler ekranları boş kalmasın diye sentetik kayıt üretir. Gerçek mükellef verisi kullanılmaz.
//
// Yazma yolu gerçek olanla aynıdır: sentetik "Geçerli E-Beyanname Sözleşmeleri Listesi" ve beyanname sorguları
// kurumdan gelmiş gibi `importFilingContracts` / `importDeclarations` üzerinden, aynı fail-closed doğrulamalardan
// (erişim kanıtı, dönem/yükleme tutarlılığı, SGK satır denetimi) geçerek uygulanır. Bağlam sistem bağlamıdır.
//
// Belgeler: `belgeDepo` verilirse her beyannameye ve SGK satırına gerçek bir PDF üretilip demo S3'e yazılır
// (bkz. demo-belge.ts), böylece /beyanname/belge ekranı dolar ve indirme de çalışır. Depo verilmezse belge üretilmez.
import { randomUUID } from 'node:crypto';
import { importFilings, type FilingRepository, type SgkFilingRecord } from '@eworks/social-security';
import {
  importDeclarations,
  importFilingContracts,
  type ContractList,
  type ContractRepository,
  type ContractRow,
  type Ctx,
  type DeclarationQuery,
  type DeclarationRecord,
  type DeclarationRepository,
  type DocumentPort,
  type FirmPort,
} from '@eworks/tax-filing';
import { belgeleriEkle, type BelgeDepo } from './demo-belge.ts';
import { VARSAYILAN_TOHUM, adTohumu, sec, tohumluRastgele } from './demo-rastgele.ts';

export type DemoFirma = { id: string; taxId: string; title: string; taxOffice: string | null };

export type BeyannameDeps = {
  firms: FirmPort;
  contracts: ContractRepository;
  declarations: DeclarationRepository;
  filings: FilingRepository;
  documents: DocumentPort;
};

/** Kaynak etiketi: ekranlarda "sahte GİB (demo)" diye görünür, gerçek kurum verisiyle karışmaz. */
const KAYNAK = 'sahte_gib' as const;
const SOZLESME_TURU = 'Aracılık ve Sorumluluk Sözleşmesi';
const HIZMET = 'e-Beyanname Gönderme';

/** Son `adet` kapanmış ay, eskiden yeniye: ["2026-07", "2026-08", "2026-09"]. */
function sonAylar(bugun: Date, adet: number): string[] {
  const aylar: string[] = [];
  for (let i = adet; i >= 1; i--) {
    const d = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth() - i, 1));
    aylar.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return aylar;
}

/** Dönemi izleyen ayın `gun`'ü, İstanbul saatiyle: beyanname gerçekte dönemden sonraki ay verilir. */
function verilisZamani(donem: string, gun: number): string {
  const [yil, ay] = donem.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(yil, ay, gun));
  return `${d.toISOString().slice(0, 10)}T10:00:00+03:00`;
}

/** Sözleşme numarası firma kimliğinden türetilir: liste ile sorgunun erişim kanıtı aynı numarayı göstermeli. */
const sozlesmeNo = (firma: DemoFirma) => `DEMO-${String(adTohumu(firma.id)).padStart(10, '0').slice(-10)}`;

/** GİB "Geçerli E-Beyanname Sözleşmeleri Listesi" taklidi: mükellef başına bir aracılık sözleşmesi. */
export function demoSozlesmeListesi(firmalar: readonly DemoFirma[], tohum: number = VARSAYILAN_TOHUM): ContractList {
  const contracts: ContractRow[] = firmalar.map((f) => {
    const rnd = tohumluRastgele((tohum ^ adTohumu(f.id)) >>> 0);
    const vkn = f.taxId.length === 10;
    const yil = 2019 + Math.floor(rnd() * 6);
    const tarih = `${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}.${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}.${yil}`;
    return {
      taxNumber: vkn ? f.taxId : '',
      identityNumber: vkn ? '' : f.taxId,
      name: f.title,
      taxOffice: f.taxOffice ?? '',
      number: sozlesmeNo(f),
      date: tarih,
      service: HIZMET,
      registeredAt: tarih,
      type: SOZLESME_TURU,
    };
  });
  return { count: contracts.length, contracts };
}

/** Sentetik SGK işyeri sicil numarası: 26 hane (kural 17–30). */
function isyeriSicil(rnd: () => number): string {
  return Array.from({ length: 26 }, () => Math.floor(rnd() * 10)).join('');
}

const TAHAKKUK = ['Tahakkuk etti', 'Ödendi', 'Tahakkuk bekliyor'] as const;

/**
 * Her mükellef için bir beyanname sorgusu. Erişim kanıtı aynı oturumda okunan listedeki aracılık sözleşmesidir
 * (gerçek kuralın aynısı); kanıt tutmazsa içe aktarma o sorguyu hiç uygulamaz.
 */
export function demoSorgular(
  firmalar: readonly DemoFirma[],
  liste: ContractList,
  tohum: number = VARSAYILAN_TOHUM,
  bugun: Date = new Date(),
  ayAdedi = 3,
): DeclarationQuery[] {
  const bugunGun = bugun.toISOString().slice(0, 10);
  const aylar = sonAylar(bugun, ayAdedi);
  return firmalar.map((firma) => {
    const rnd = tohumluRastgele((tohum ^ adTohumu(`beyanname:${firma.id}`)) >>> 0);
    const numara = liste.contracts.find((c) => c.taxNumber === firma.taxId || c.identityNumber === firma.taxId)?.number ?? sozlesmeNo(firma);
    const records: DeclarationRecord[] = [];
    for (const donem of aylar) {
      for (const [tur, gun] of [['KDV1', 24], ['MUHSGK', 26]] as const) {
        const uploadedAt = verilisZamani(donem, gun);
        if (uploadedAt.slice(0, 10) > bugunGun) continue;
        const sgk: SgkFilingRecord[] =
          tur === 'MUHSGK'
            ? [
                {
                  recordId: `demo-${firma.id}-${donem}-sgk`,
                  workplace: isyeriSicil(rnd),
                  period: donem,
                  status: 'Onaylandı',
                  employeeCount: 1 + Math.floor(rnd() * 25),
                  documents: [],
                  documentWarnings: [],
                },
              ]
            : [];
        records.push({
          recordId: `demo-${firma.id}-${donem}-${tur}`,
          type: tur,
          periodStart: donem,
          periodEnd: donem,
          uploadedAt,
          taxStatus: sec(rnd, TAHAKKUK),
          sgkStatus: tur === 'MUHSGK' ? 'Onaylandı' : '',
          branch: '',
          reference: `demo-${donem}-${tur}.xml`,
          referenceType: 'source_filename',
          documents: [],
          documentWarnings: [],
          ...(tur === 'MUHSGK' ? { sgk } : {}),
        });
      }
    }
    const ilkGun = records.length > 0 ? (records[0] as DeclarationRecord).uploadedAt.slice(0, 10) : bugunGun;
    return { identity: firma.taxId, startDate: ilkGun, endDate: bugunGun, outcome: 'ok' as const, access: { method: 'same_session_contract' as const, contractNumbers: [numara] }, records };
  });
}

/**
 * Demo sözleşme, beyanname ve SGK bildirimlerini ofise yazar. Tekrar çalıştırılabilir (`yeni` ikinci koşuda 0).
 * `importDeclarations` doğrulanmayan sorguyu yalnız **sayar**; burada bu sayımlar hataya çevrilir, yoksa boş
 * ekran sessizce "başarılı" görünürdü.
 */
export async function demoBeyannameleriAc(
  ctx: Ctx,
  firmalar: readonly DemoFirma[],
  d: BeyannameDeps,
  ayar: {
    advisorId: string;
    tohum?: number;
    bugun?: Date;
    jobId?: string;
    sorguUreteci?: (f: readonly DemoFirma[], l: ContractList, t: number, g: Date) => DeclarationQuery[];
    /** Verilirse beyanname ve SGK belgeleri gerçek PDF olarak üretilip buraya yazılır. */
    belgeDepo?: BelgeDepo;
  },
): Promise<{ sozlesme: number; beyanname: number; yeni: number; sgk: number; belge: number; hatalar: string[] }> {
  const bos = { sozlesme: 0, beyanname: 0, yeni: 0, sgk: 0, belge: 0, hatalar: [] as string[] };
  if (firmalar.length === 0) return bos;
  const tohum = ayar.tohum ?? VARSAYILAN_TOHUM;
  const bugun = ayar.bugun ?? new Date();
  const jobId = ayar.jobId ?? randomUUID();
  const liste = demoSozlesmeListesi(firmalar, tohum);

  const s = await importFilingContracts(ctx, { jobId, advisorId: ayar.advisorId, source: KAYNAK, list: liste }, { firms: d.firms, contracts: d.contracts });
  if (!s.ok) return { ...bos, hatalar: [s.error] };

  const uretilen = (ayar.sorguUreteci ?? demoSorgular)(firmalar, liste, tohum, bugun);
  // Belgeler içe aktarmadan ÖNCE depoya yazılır: kayıt göründüğü anda indirilebilir olmalı
  const sorgular = ayar.belgeDepo ? await belgeleriEkle(ctx.org, uretilen, ayar.belgeDepo) : uretilen;
  let sgk = 0;
  const ozet = await importDeclarations(
    ctx,
    { jobId, source: KAYNAK, contracts: liste.contracts, queries: sorgular },
    {
      firms: d.firms,
      declarations: d.declarations,
      documents: d.documents,
      onSaved: async (firmId, declarationId, r) => {
        if (r.type !== 'MUHSGK' || !r.sgk?.length) return;
        const t = await importFilings(
          ctx,
          { firmId, declarationId, parent: r, rows: r.sgk as SgkFilingRecord[], source: KAYNAK, jobId },
          { filings: d.filings, documents: { register: (c, docs) => d.documents.register(c, docs) } },
        );
        sgk += t.bildirim;
        if (t.gecersiz > 0) throw new Error('SGK satırları doğrulanamadı');
      },
    },
  );

  // Sessiz sayımları hataya çevir: bunlar demo verisinin ekrana hiç ulaşmadığı durumlardır
  const hatalar: string[] = [];
  if (ozet.erisim_yok > 0) hatalar.push(`erisim_yok:${ozet.erisim_yok}`);
  if (ozet.basarisiz > 0) hatalar.push(`basarisiz:${ozet.basarisiz}`);
  if (ozet.firma_yok > 0) hatalar.push(`firma_yok:${ozet.firma_yok}`);
  return { sozlesme: s.summary.sozlesme, beyanname: ozet.beyanname, yeni: ozet.yeni, sgk, belge: ozet.belge, hatalar };
}
