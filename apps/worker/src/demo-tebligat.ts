// Demo verisi — e-Tebligat (D45): demo/geliştirme kipinde /tebligat/liste ekranı boş kalmasın diye sentetik liste
// kaydı üretir. Gerçek tebligat verisi kullanılmaz ve belge içeriği hiç tutulmaz (bağlam yalnız liste bilgisi saklar).
//
// Yazma yolu gerçek olanla aynıdır: kayıtlar `importNotices` ile, yani kurumdan gelen listeyle aynı doğrulamadan
// (`validateNoticeList`) geçerek yazılır. Bağlam sistem bağlamıdır (`sub` yok), çünkü e-Tebligat'a yalnız işçi yazar.
import { createHash, randomUUID } from 'node:crypto';
import { importNotices, type Ctx, type NoticeRepository, type ValidNotice } from '@eworks/notices';
import { VARSAYILAN_TOHUM, adTohumu, gunEkle, sec, tohumluRastgele } from './demo-rastgele.ts';

/** Vergi dairesi firma kartında boş olabilir; gönderen alt birimi o zaman boş kalır (alan boşa izin verir). */
export type DemoFirma = { id: string; title: string; taxOffice: string | null };

/** GİB Dijital Vergi Dairesi'nden e-Tebligat ile gelen yaygın belge türleri. */
const BELGE_TURU = [
  'Ödeme Emri',
  'Vergi/Ceza İhbarnamesi',
  'Bilgi İsteme Yazısı',
  'İzaha Davet Yazısı',
  'Teminat İsteme Yazısı',
  'Takdir Komisyonu Kararı',
  'Haciz Bildirisi',
] as const;

const GONDEREN = 'Gelir İdaresi Başkanlığı';

/**
 * Bir firmanın sentetik e-Tebligat kayıtları. Tarih kurgusu alan gerçeğine uyar:
 * - Mükellef belgeyi açtıysa tebliğ tarihi okuma günüdür.
 * - Açmadıysa VUK 107/A gereği hesaba ulaşmasından sonraki 5. günün sonunda tebliğ edilmiş sayılır.
 * - Henüz 5 gün geçmemiş ve açılmamış kayıtta tebliğ tarihi yoktur (ekranın uyardığı durum).
 *
 * `sira` ofis içindeki firma sırasıdır: her dördüncü firmanın en yeni tebligatı "taze" (tebliğ ve okuma tarihi boş)
 * olur. Böylece bu durum şansa bırakılmadan her demo listesinde görünür — 180 günlük aralıkta rastgele seçilen
 * kayıtların neredeyse tamamı 5 günü aşar ve tebliğ tarihi dolu çıkardı.
 */
export function demoTebligatlari(firma: DemoFirma, tohum: number = VARSAYILAN_TOHUM, bugun: Date = new Date(), sira = 0): ValidNotice[] {
  const rnd = tohumluRastgele((tohum ^ adTohumu(firma.id)) >>> 0);
  const adet = 1 + Math.floor(rnd() * 4);
  const kayitlar: ValidNotice[] = [];
  for (let i = 0; i < adet; i++) {
    const taze = i === 0 && sira % 4 === 0;
    const gecenGun = taze ? 1 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 180);
    const sentOn = gunEkle(bugun, -gecenGun);
    const okundu = !taze && rnd() < 0.6;
    let deliveredOn: string | null = null;
    let readOn: string | null = null;
    if (okundu) {
      // Okuma günü gönderimden sonra ve bugünden önce olmalı
      const gecikme = Math.min(1 + Math.floor(rnd() * 4), gecenGun);
      readOn = gunEkle(bugun, -(gecenGun - gecikme));
      deliveredOn = readOn;
    } else if (gecenGun > 5) {
      deliveredOn = gunEkle(bugun, -(gecenGun - 5));
    }
    kayitlar.push({
      // Kurum kayıt kimliği açık saklanmaz; ACL gerçekte de SHA-256 üretir
      noticeKey: createHash('sha256').update(`demo:tebligat:${firma.id}:${i}`).digest('hex'),
      reference: `${sentOn.slice(0, 4)}/${100000 + Math.floor(rnd() * 900000)}`,
      documentType: sec(rnd, BELGE_TURU),
      sender: GONDEREN,
      department: firma.taxOffice ?? '',
      sentOn,
      deliveredOn,
      readOn,
    });
  }
  // Ekranda da olduğu gibi en yeni gönderim üstte
  return kayitlar.sort((a, b) => (a.sentOn === b.sentOn ? a.reference.localeCompare(b.reference, 'tr') : (a.sentOn < b.sentOn ? 1 : -1)));
}

/**
 * Demo tebligatlarını ofisin firmalarına yazar. Tekrar çalıştırılabilir: aynı kayıt ikinci koşuda güncellenir
 * (`guncellenen`), yinelenmez. Doğrulama hatası sessizce yutulmaz — `hatalar` boş değilse çağıran durur.
 */
export async function demoTebligatlariniAc(
  ctx: Ctx,
  firmalar: readonly DemoFirma[],
  repo: NoticeRepository,
  ayar: { tohum?: number; bugun?: Date; jobId?: string; uretec?: (f: DemoFirma, tohum: number, bugun: Date, sira: number) => ValidNotice[] } = {},
): Promise<{ eklenen: number; guncellenen: number; hatalar: string[] }> {
  const tohum = ayar.tohum ?? VARSAYILAN_TOHUM;
  const bugun = ayar.bugun ?? new Date();
  const uretec = ayar.uretec ?? demoTebligatlari;
  const jobId = ayar.jobId ?? randomUUID();
  let eklenen = 0;
  let guncellenen = 0;
  const hatalar: string[] = [];
  for (const [sira, firma] of firmalar.entries()) {
    const kayitlar = uretec(firma, tohum, bugun, sira);
    const r = await importNotices(
      ctx,
      { jobId, firmId: firma.id, list: { count: kayitlar.length, accountVerified: true, documentsOpened: false, records: kayitlar } },
      repo,
    );
    if (!r.ok) {
      hatalar.push(r.error);
      continue;
    }
    eklenen += r.value.yeni;
    guncellenen += r.value.guncellenen;
  }
  return { eklenen, guncellenen, hatalar };
}
