// SGK 4A Sigortalı İşe Giriş / İşten Ayrılış (Sigortalı Tescil) web servisi.
//
// DİKKAT: Bu servisin metot ve alan adları henüz resmi kılavuzdan doğrulanmadı.
// Kılavuz: e-SGK "4a Sigortalı İşe Giriş ve İşten Ayrılış Bildirgesi" sayfasındaki
// 4atescilWS_Kullanim_Kilavuzu.doc. Test ortamı erişimi için işyeri sicili
// entegretescil@sgk.gov.tr adresine bildirilmelidir. Aşağıdaki arayüz uygulamanın
// ihtiyacını tanımlar; canlı istemci kılavuza göre bu arayüzü gerçekleyecektir.

export interface TescilCredentials {
  kullaniciAdi: string; // e-Bildirge kullanıcı adı
  sistemSifresi: string;
  isyeriSifresi: string;
}

export interface TescilRecord {
  tckn: string;
  ad: string;
  soyad: string;
  tarih: Date; // giriş veya ayrılış tarihi
  sigortaliTuru?: string;
  meslekKodu?: string;
  ayrilisNedeniKodu?: string;
  ayrilisNedeni?: string;
  referansNo?: string;
}

export interface TescilClient {
  readonly mode: 'mock' | 'live';
  /** Bilgileri doğrular (kaydetmeden önce çağrılır). */
  verify(c: TescilCredentials): Promise<void>;
  /** Tarih aralığında SGK'ya verilmiş işe giriş bildirgeleri. */
  entries(c: TescilCredentials, from: Date, to: Date): Promise<TescilRecord[]>;
  /** Tarih aralığında SGK'ya verilmiş işten ayrılış bildirgeleri. */
  exits(c: TescilCredentials, from: Date, to: Date): Promise<TescilRecord[]>;
}

export const TESCIL_CLIENT = Symbol('TESCIL_CLIENT');

export class TescilError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** İşten ayrılış nedeni kodları (bildirge formundaki yaygın kodlar). */
export const EXIT_REASONS: Record<string, string> = {
  '03': 'Belirsiz süreli iş sözleşmesinin işçi tarafından feshi',
  '04': 'Belirsiz süreli iş sözleşmesinin işveren tarafından haklı sebep bildirilmeden feshi',
  '05': 'Belirli süreli iş sözleşmesinin sona ermesi',
  '10': 'Ölüm',
  '22': 'Diğer nedenler',
  '29': 'İşveren tarafından ahlak ve iyi niyet kurallarına aykırı davranış nedeniyle fesih',
};
