import { cookies } from 'next/headers';
import { enableTotp, SESSION_TTL } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { adimCerezi, ayniKoken, cerezAyari, jsonGovde, oturumCerezi } from '@/bff/oturum.ts';

const json = (status: number, govde: Record<string, unknown>) => Response.json(govde, { status });

// 2FA kurulum onayı (ara adım çereziyle; aynı köken): kod doğruysa 2FA açılır, oturum çerezi verilir, kurtarma kodları
// yalnız bu yanıtta döner (Cache-Control: no-store, next.config).
export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return json(403, { mesaj: 'İstek kaynağı doğrulanamadı.' });
  const c = await cookies();
  const adim = c.get(adimCerezi())?.value;
  if (!adim) return json(401, { mesaj: 'Giriş adımının süresi doldu.' });
  const g = await jsonGovde<{ kod?: unknown }>(req, 256);
  if (!g) return json(400, { mesaj: 'İstek geçersiz.' });
  try {
    const r = await enableTotp(adim, String(g.kod ?? '').slice(0, 6), konteyner().giris);
    if (!r.ok) {
      if (r.error === 'kod_hatali' && (await konteyner().giris.sessions.get(adim))) return json(422, { mesaj: 'Kod hatalı; telefonunuzdaki güncel kodu girin.' });
      c.delete(adimCerezi());
      return json(401, { mesaj: 'Giriş adımının süresi doldu.' });
    }
    c.delete(adimCerezi());
    c.set(oturumCerezi(), r.value.sessionId, cerezAyari(SESSION_TTL));
    return json(200, { kurtarmaKodlari: r.value.recoveryCodes, sonraki: r.value.mustChangePassword ? '/sifre' : '/' });
  } catch (e) {
    hataGunlugu('satis.oturum.kurulum', e);
    return json(500, { mesaj: 'İşlem şu an yapılamıyor; biraz sonra tekrar deneyin.' });
  }
}
