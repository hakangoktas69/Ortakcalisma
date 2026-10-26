import { cookies } from 'next/headers';
import { disableTotp } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { jsonGovde, oturumCerezi, satisApiIzni } from '@/bff/oturum.ts';

const HATA = {
  // Parola ve kod hatası aynı mesajı alır: hangisinin doğru olduğu ele verilmez
  kimlik_hatali: [422, 'Parola ya da kod hatalı.'],
  kilitli: [423, 'Çok sayıda hatalı deneme: hesap 15 dakika kilitli.'],
  kapali: [409, 'İki adımlı doğrulama zaten kapalı.'],
} as const;

// 2FA kapatma (satis.oturum.mfa): parola + güncel kod ya da kurtarma kodu; yanlış deneme hatalı giriş sayacını işletir.
// Diğer oturumlar düşer, bu oturum sürer. Sonraki girişlerde resimli güvenlik kodu istenir.
export async function POST(req: Request) {
  const s = await satisApiIzni(req, 'satis.oturum.mfa', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ parola?: unknown; kod?: unknown; kurtarma?: unknown }>(req, 1024);
  if (!g || typeof g.parola !== 'string') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const kurtarma = typeof g.kurtarma === 'string' ? g.kurtarma.slice(0, 20).trim() : '';
  const oturum = (await cookies()).get(oturumCerezi())?.value ?? '';
  try {
    const r = await disableTotp(
      oturum,
      s,
      { password: g.parola.slice(0, 128), ...(kurtarma ? { recoveryCode: kurtarma } : { code: String(g.kod ?? '').slice(0, 6) }) },
      konteyner().giris,
    );
    if (r.ok) return Response.json({ ok: true });
    const [durum, mesaj] = HATA[r.error];
    return Response.json({ mesaj }, { status: durum });
  } catch (e) {
    hataGunlugu('satis.oturum.2fa_kapat', e);
    return Response.json({ mesaj: 'İşlem şu an yapılamıyor; biraz sonra tekrar deneyin.' }, { status: 500 });
  }
}
