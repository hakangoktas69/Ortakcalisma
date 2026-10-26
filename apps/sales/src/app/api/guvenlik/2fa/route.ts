import { cookies } from 'next/headers';
import { confirmTotpEnrollment } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { jsonGovde, oturumCerezi, satisApiIzni } from '@/bff/oturum.ts';

const HATA = {
  kod_hatali: [422, 'Kod hatalı; telefonunuzdaki güncel kodu girin.'],
  kurulum_yok: [409, 'Kurulum süresi doldu; sayfayı yenileyip QR kodu yeniden okutun.'],
  zaten_acik: [409, 'İki adımlı doğrulama zaten açık.'],
  kimlik_hatali: [422, 'Parola hatalı.'],
  kilitli: [423, 'Çok sayıda hatalı deneme: hesap 15 dakika kilitli.'],
} as const;

// 2FA açma onayı (satis.oturum.mfa): parola + kod doğruysa açılır (çalınmış oturum çereziyle açılamaz); kurtarma kodları
// yalnız bu yanıtta (Cache-Control: no-store). Diğer oturumlar düşer, bu oturum sürer.
export async function POST(req: Request) {
  const s = await satisApiIzni(req, 'satis.oturum.mfa', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ kod?: unknown; parola?: unknown }>(req, 512);
  if (!g || typeof g.parola !== 'string') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  try {
    const oturum = (await cookies()).get(oturumCerezi())?.value ?? '';
    const r = await confirmTotpEnrollment(oturum, s, { password: g.parola.slice(0, 128), code: String(g.kod ?? '').slice(0, 6) }, konteyner().giris);
    if (r.ok) return Response.json({ kurtarmaKodlari: r.value.recoveryCodes });
    const [durum, mesaj] = HATA[r.error];
    return Response.json({ mesaj }, { status: durum });
  } catch (e) {
    hataGunlugu('satis.oturum.2fa_ac', e);
    return Response.json({ mesaj: 'İşlem şu an yapılamıyor; biraz sonra tekrar deneyin.' }, { status: 500 });
  }
}
