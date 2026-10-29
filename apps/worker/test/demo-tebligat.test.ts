import { describe, expect, it } from 'vitest';
import { validateNoticeList, type Ctx, type NoticeRepository, type StoredNotice, type ValidNotice } from '@eworks/notices';
import { demoTebligatlari, demoTebligatlariniAc, type DemoFirma } from '../src/demo-tebligat.ts';

// e-Tebligat ekranı demo/geliştirme kipinde boş kalmasın diye sentetik liste kaydı üretilir.
// Gerçek tebligat verisi kullanılmaz; belge içeriği hiç yoktur (D45: yalnız liste bilgisi).

const ctx: Ctx = { org: 'ofis-1' }; // sistem bağlamı: e-Tebligat'a yalnız işçi yazar (RLS app.is_system)
const BUGUN = new Date('2026-10-29T00:00:00Z');

const firmalar: DemoFirma[] = [
  { id: 'firma-1', title: 'Çınar Tekstil Ltd. Şti.', taxOffice: 'Gazi Vergi Dairesi' },
  { id: 'firma-2', title: 'Deniz Güneş', taxOffice: 'İlkadım Vergi Dairesi' },
  { id: 'firma-3', title: 'Ege Lojistik A.Ş.', taxOffice: 'Karşıyaka Vergi Dairesi' },
  { id: 'firma-4', title: 'Lale Gıda Ltd. Şti.', taxOffice: 'Çankaya Vergi Dairesi' },
];

/** Gerçek adaptörün sözleşmesini taklit eden bellek içi depo: (firmId, noticeKey) tekil, ikinci yazma günceller. */
function depo() {
  const kayitlar = new Map<string, StoredNotice>();
  const repo: NoticeRepository = {
    upsert: async (_c, firmId, rows, jobId) => {
      let yeni = 0;
      for (const r of rows) {
        const k = `${firmId}|${r.noticeKey}`;
        if (!kayitlar.has(k)) yeni++;
        kayitlar.set(k, { ...r, id: k, firmId, firmTitle: null, jobId });
      }
      return { yeni, guncellenen: rows.length - yeni };
    },
    list: async () => [...kayitlar.values()],
  };
  return { repo, kayitlar };
}

describe('demo tebligat kayıtları', () => {
  it('gerçek liste doğrulamasından geçer', () => {
    for (const f of firmalar) {
      const kayitlar = demoTebligatlari(f, 1, BUGUN);
      const r = validateNoticeList({ count: kayitlar.length, accountVerified: true, documentsOpened: false, records: kayitlar });
      expect(r.ok, `${f.title} listesi geçersiz`).toBe(true);
    }
  });

  it('kurum kayıt kimliği 64 haneli özet ve firma içinde tekildir', () => {
    const kayitlar = demoTebligatlari(firmalar[0] as DemoFirma, 1, BUGUN);
    for (const k of kayitlar) expect(k.noticeKey).toMatch(/^[a-f0-9]{64}$/);
    expect(new Set(kayitlar.map((k) => k.noticeKey)).size).toBe(kayitlar.length);
  });

  it('farklı firmalar farklı kayıt kimliği alır', () => {
    const a = demoTebligatlari(firmalar[0] as DemoFirma, 1, BUGUN).map((k) => k.noticeKey);
    const b = demoTebligatlari(firmalar[1] as DemoFirma, 1, BUGUN).map((k) => k.noticeKey);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
  });

  it('aynı tohum aynı sonucu verir (tekrarlanabilir demo)', () => {
    expect(demoTebligatlari(firmalar[0] as DemoFirma, 7, BUGUN)).toEqual(demoTebligatlari(firmalar[0] as DemoFirma, 7, BUGUN));
  });

  it('tarihler tutarlı: gönderim ≤ tebliğ ≤ okuma ve hiçbiri gelecekte değil', () => {
    const bugun = BUGUN.toISOString().slice(0, 10);
    for (const f of firmalar) {
      for (const k of demoTebligatlari(f, 3, BUGUN)) {
        expect(k.sentOn <= bugun, `gönderim gelecekte: ${k.sentOn}`).toBe(true);
        if (k.deliveredOn) {
          expect(k.deliveredOn >= k.sentOn).toBe(true);
          expect(k.deliveredOn <= bugun).toBe(true);
        }
        if (k.readOn) {
          expect(k.deliveredOn, 'tebliğ edilmeden okunmuş görünemez').not.toBeNull();
          expect(k.readOn >= (k.deliveredOn as string)).toBe(true);
          expect(k.readOn <= bugun).toBe(true);
        }
      }
    }
  });

  it('ekranın uyardığı "henüz tebliğ edilmemiş" durumu her listede bulunur', () => {
    // Sıranın başındaki firma taze bir tebligat alır: tebliğ ve okuma tarihi boş. Ekranın açıklama metni tam
    // bunu anlatıyor ("okuma tarihinin olmaması tebliğ edilmediği anlamına gelmez"), demoda görünmeli.
    const kayitlar = demoTebligatlari(firmalar[0] as DemoFirma, 1, BUGUN, 0);
    expect(kayitlar.some((k) => k.deliveredOn === null && k.readOn === null)).toBe(true);
  });

  it('ekranın anlamlı görünmesi için okunmuş ve okunmamış kayıt birlikte bulunur', () => {
    const hepsi = firmalar.flatMap((f) => demoTebligatlari(f, 3, BUGUN));
    expect(hepsi.some((k) => k.readOn === null)).toBe(true);
    expect(hepsi.some((k) => k.readOn !== null)).toBe(true);
    expect(new Set(hepsi.map((k) => k.documentType)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('demo tebligatlarını açma', () => {
  it('firmalara kayıt ekler', async () => {
    const d = depo();
    const sonuc = await demoTebligatlariniAc(ctx, firmalar, d.repo, { tohum: 1, bugun: BUGUN });
    expect(sonuc.hatalar).toEqual([]);
    expect(sonuc.eklenen).toBe(d.kayitlar.size);
    expect(sonuc.eklenen).toBeGreaterThan(0);
    // Boş tebliğ/okuma sütunu da, dolu olanı da ekranda görünsün
    const hepsi = [...d.kayitlar.values()];
    expect(hepsi.some((k) => k.deliveredOn === null)).toBe(true);
    expect(hepsi.some((k) => k.deliveredOn !== null)).toBe(true);
  });

  it('ikinci kez çalıştırmada yeni kayıt açmaz, günceller (tekrar çalıştırılabilir)', async () => {
    const d = depo();
    const ilk = await demoTebligatlariniAc(ctx, firmalar, d.repo, { tohum: 1, bugun: BUGUN });
    const boyut = d.kayitlar.size;
    const ikinci = await demoTebligatlariniAc(ctx, firmalar, d.repo, { tohum: 1, bugun: BUGUN });
    expect(ikinci).toEqual({ eklenen: 0, guncellenen: ilk.eklenen, hatalar: [] });
    expect(d.kayitlar.size).toBe(boyut);
  });

  it('firma yoksa hiçbir şey yazmaz', async () => {
    const d = depo();
    expect(await demoTebligatlariniAc(ctx, [], d.repo, { tohum: 1, bugun: BUGUN })).toEqual({ eklenen: 0, guncellenen: 0, hatalar: [] });
    expect(d.kayitlar.size).toBe(0);
  });

  it('doğrulama hatası sessizce yutulmaz', async () => {
    const d = depo();
    // Üreteç bozulursa (ör. aynı kayıt kimliği iki kez) hata bildirilmeli: sessiz atlama boş ekranı gizler
    const bozuk = (f: DemoFirma) => {
      const k = demoTebligatlari(f, 1, BUGUN)[0] as ValidNotice;
      return [k, k];
    };
    const sonuc = await demoTebligatlariniAc(ctx, firmalar, d.repo, { tohum: 1, bugun: BUGUN, uretec: bozuk });
    expect(sonuc.hatalar).toEqual(['tekrarlanan_kayit', 'tekrarlanan_kayit', 'tekrarlanan_kayit', 'tekrarlanan_kayit']);
    expect(sonuc.eklenen).toBe(0);
    expect(d.kayitlar.size).toBe(0);
  });
});

/** Tip sözleşmesi: üretilen kayıt ValidNotice'tir (belge içeriği alanı yok). */
export const _tip: (k: ValidNotice) => string = (k) => k.reference;
