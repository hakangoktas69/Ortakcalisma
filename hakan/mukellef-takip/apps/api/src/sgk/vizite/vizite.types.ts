// SGK WS_VİZİTE web servisi tipleri.
// Kaynak: SGK "WS_VİZİTE (4/A Çalışanlar İçin Çalışmadı Bildirim Web Servisi)" kılavuzu
// ve https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder WSDL'i.

export interface ViziteCredentials {
  kullaniciAdi: string; // Vizite kullanıcı kodu (T.C. kimlik no)
  isyeriKodu: string; // Vizite işyeri kodu
  isyeriSifresi: string; // Vizite web servis şifresi
}

/** RaporAramaTarihleBean / OnayliRaporlarTarihleBean alanları (WSDL'deki yazımla). */
export interface ViziteReportRow {
  MEDULARAPORID: string;
  TCKIMLIKNO: string;
  AD?: string;
  SOYAD?: string;
  RAPORTAKIPNO?: string;
  RAPORSIRANO?: string;
  POLIKLINIKTAR?: string;
  YATRAPBASTAR?: string;
  YATRAPBITTAR?: string;
  ABASTAR?: string;
  ABITTAR?: string;
  ISBASKONTTAR?: string;
  ISKAZASITARIHI?: string;
  RAPORDURUMU?: string;
  VAKA?: string;
  VAKAADI?: string;
  TESISKODU?: string;
  TESISADI?: string;
}

export interface ViziteClient {
  readonly mode: 'mock' | 'live';
  /** 30 dakika geçerli token döner. */
  login(c: ViziteCredentials): Promise<string>;
  /** Poliklinik tarihi `before` tarihinden küçük, okunmamış ilk 100 rapor. */
  pendingReports(c: ViziteCredentials, token: string, before: Date): Promise<ViziteReportRow[]>;
  /** Okunan raporu kapatır; kapatılmazsa sonraki sorgularda yeni raporlar gelmez. */
  markRead(c: ViziteCredentials, token: string, medulaRaporId: string): Promise<void>;
  approvedReports(c: ViziteCredentials, token: string, from: Date, to: Date): Promise<ViziteReportRow[]>;
  /** Çalışmazlık bildirimi. nitelikDurumu: '0' çalışmadı, '1' çalıştı. */
  approve(
    c: ViziteCredentials,
    token: string,
    input: { tckn: string; vaka: number; medulaRaporId: string; nitelikDurumu: '0' | '1'; tarih: Date },
  ): Promise<void>;
}

export const VIZITE_CLIENT = Symbol('VIZITE_CLIENT');

/** SGK'nın döndüğü sonucKod ≠ 0 durumları. */
export class ViziteError extends Error {
  constructor(
    public readonly method: string,
    public readonly code: number,
    message: string,
  ) {
    super(`${method}: ${message} (kod ${code})`);
  }

  /** 105: kullanıcı/işyeri kodu/şifre hatalı. 106: token hatalı veya süresi dolmuş. */
  get isAuthError() {
    return this.code === 105 || this.code === 106;
  }

  /** 503/505: kayıt bulunamadı — hata değil, boş liste. */
  get isEmpty() {
    return this.code === 503 || this.code === 505;
  }
}

export const VAKA_ADI: Record<number, string> = {
  1: 'İş Kazası',
  2: 'Meslek Hastalığı',
  3: 'Hastalık',
  4: 'Analık',
};

/** SGK tarih biçimi: dd.mm.yyyy */
export function toSgkDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** "dd.mm.yyyy" veya ISO biçimini Date'e çevirir; boş/geçersizse null. */
export function parseSgkDate(s?: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s.trim());
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
