import { Injectable } from '@nestjs/common';
import {
  VAKA_ADI,
  ViziteError,
  toSgkDate,
  type ViziteClient,
  type ViziteCredentials,
  type ViziteReportRow,
} from '../../application/ports/vizite.types.js';

const names = ['Ahmet Yılmaz', 'Ayşe Kaya', 'Mehmet Demir', 'Fatma Şahin', 'Ali Çelik', 'Zeynep Aydın', 'Emre Arslan'];

interface MockReport extends ViziteReportRow {
  read: boolean;
  approved: boolean;
}

/**
 * SGK'ya hiç bağlanmadan aynı sözleşmeyi uygulayan demo istemci (SGK_MODE=mock).
 * Gerçek servisin kurallarını taklit eder: 100 rapor sınırı, okundu-kapat zorunluluğu,
 * hatalı şifrede 105 hatası. Şifresi "hatali" olan işyeri giriş hatası verir.
 */
@Injectable()
export class MockViziteClient implements ViziteClient {
  readonly mode = 'mock' as const;
  private readonly store = new Map<string, MockReport[]>();
  private seq = 900000000000000000n;

  private reportsFor(c: ViziteCredentials): MockReport[] {
    const key = `${c.kullaniciAdi}/${c.isyeriKodu}`;
    let list = this.store.get(key);
    if (!list) {
      // İşyeri koduna göre deterministik: her işyerinde 1–4 rapor
      const n = (Number(c.isyeriKodu) % 4) + 1;
      list = Array.from({ length: n }, (_, i) => this.makeReport(i + Number(c.isyeriKodu)));
      this.store.set(key, list);
    }
    // Her senkronda %30 ihtimalle yeni bir rapor düşsün
    if (Math.random() < 0.3) list.push(this.makeReport(list.length + 7));
    return list;
  }

  private makeReport(i: number): MockReport {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (i % 6));
    const end = new Date(start);
    end.setDate(start.getDate() + 2 + (i % 5));
    const vaka = i % 9 === 0 ? 1 : 3;
    const [ad, soyad] = names[i % names.length].split(' ');
    return {
      MEDULARAPORID: String(this.seq++),
      TCKIMLIKNO: String(10000000000 + ((i * 7919) % 89999999999)).padStart(11, '1'),
      AD: ad,
      SOYAD: soyad,
      POLIKLINIKTAR: toSgkDate(start),
      ABASTAR: toSgkDate(start),
      ABITTAR: toSgkDate(end),
      ISBASKONTTAR: toSgkDate(new Date(end.getTime() + 86_400_000)),
      RAPORDURUMU: '1',
      VAKA: String(vaka),
      VAKAADI: VAKA_ADI[vaka],
      TESISADI: ['Devlet Hastanesi', 'Aile Sağlığı Merkezi', 'Eğitim ve Araştırma Hastanesi'][i % 3],
      read: false,
      approved: false,
    };
  }

  async login(c: ViziteCredentials) {
    if (!c.isyeriSifresi || c.isyeriSifresi === 'hatali') {
      throw new ViziteError('wsLogin', 105, 'Kullanıcı Adı, Kullanıcı Kodu veya Şifre hatalı. Tekrar deneyin');
    }
    return `mock-${c.isyeriKodu}-${Date.now()}`;
  }

  async pendingReports(c: ViziteCredentials, _token: string, _before: Date) {
    return this.reportsFor(c)
      .filter((r) => !r.read && !r.approved)
      .slice(0, 100)
      .map(({ read: _r, approved: _a, ...row }) => row);
  }

  async markRead(c: ViziteCredentials, _token: string, medulaRaporId: string) {
    const r = this.store.get(`${c.kullaniciAdi}/${c.isyeriKodu}`)?.find((x) => x.MEDULARAPORID === medulaRaporId);
    if (!r) throw new ViziteError('raporOkunduKapat', 902, 'Rapor işyerine ait gözükmüyor.');
    r.read = true;
  }

  async approvedReports(c: ViziteCredentials, _token: string, _from: Date, _to: Date) {
    return (this.store.get(`${c.kullaniciAdi}/${c.isyeriKodu}`) ?? [])
      .filter((r) => r.approved)
      .map(({ read: _r, approved: _a, ...row }) => row);
  }

  async approve(
    c: ViziteCredentials,
    _token: string,
    input: { tckn: string; vaka: number; medulaRaporId: string; nitelikDurumu: '0' | '1'; tarih: Date },
  ) {
    if (input.tarih > new Date()) throw new ViziteError('raporOnay', 801, 'Girdiğiniz Tarih Günün Tarihinden Büyük Olamaz.');
    // Demo veriler bellekte tutulur; API yeniden başladıysa rapor burada olmayabilir, yine de onayı kabul et.
    const r = this.store.get(`${c.kullaniciAdi}/${c.isyeriKodu}`)?.find((x) => x.MEDULARAPORID === input.medulaRaporId);
    if (!r) return;
    if (r.TCKIMLIKNO !== input.tckn) throw new ViziteError('raporOnay', 601, 'Girilen TC Kimlik Numarası Raporla Uyuşmuyor.');
    r.approved = true;
  }
}
