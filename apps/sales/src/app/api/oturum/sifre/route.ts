import { cookies } from 'next/headers';
import { changeOwnPassword } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { jsonGovde, oturumCerezi, satisApiIzni } from '@/bff/oturum.ts';

// Kendi parolasını değiştirme (satis.oturum.login: giriş bilgisinin parçası). Diğer oturumlar düşer, bu oturum sürer.
export async function POST(req: Request) {
  const s = await satisApiIzni(req, 'satis.oturum.login', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ mevcut?: unknown; yeni?: unknown }>(req, 1024);
  if (!g || typeof g.mevcut !== 'string' || typeof g.yeni !== 'string') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const oturum = (await cookies()).get(oturumCerezi())?.value ?? '';
  try {
    const r = await changeOwnPassword(oturum, s, { current: g.mevcut.slice(0, 128), next: g.yeni.slice(0, 200) }, konteyner().giris);
    if (r.ok) return Response.json({ ok: true });
    if (r.error === 'kimlik_hatali') return Response.json({ mesaj: 'Mevcut parola hatalı.' }, { status: 422 });
    if (r.error === 'parola_ayni') return Response.json({ mesaj: 'Yeni parola eskisiyle aynı olamaz.' }, { status: 422 });
    return Response.json({ mesaj: r.message ?? 'Parola kurala uymuyor.' }, { status: 422 });
  } catch (e) {
    hataGunlugu('satis.oturum.sifre', e);
    return Response.json({ mesaj: 'Parola şu an değiştirilemiyor; biraz sonra tekrar deneyin.' }, { status: 500 });
  }
}
