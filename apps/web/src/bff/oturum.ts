import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorize, currentSession, isAllowed, type Session } from '@eworks/identity-access';
import { konteyner } from './konteyner.ts';

// Oturum ve yetki koruyucusu (05 §3.4): sayfa anahtarı sunucu bileşeninde, işlem anahtarı + CSRF BFF ucunda denetlenir.

/** `__Host-` öneki yalnız Secure çerezde geçerlidir; http üzerindeki demo/geliştirme yığınında sade ad kullanılır. */
export const cerezAdi = () => (konteyner().config.COOKIE_SECURE ? '__Host-ew_sid' : 'ew_sid');

export const cerezAyari = () => ({
  httpOnly: true,
  secure: konteyner().config.COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 8 * 60 * 60,
});

export async function oturum(): Promise<Session | null> {
  const id = (await cookies()).get(cerezAdi())?.value;
  return currentSession(id, konteyner());
}

/** Sayfa koruyucusu: oturum yoksa girişe yönlendirir; yetki yoksa `izinli: false` döner (sayfa 403 gösterir). */
export async function sayfaIzni(anahtar: string): Promise<{ oturum: Session; izinli: boolean }> {
  const s = await oturum();
  if (!s) redirect('/giris');
  return { oturum: s, izinli: isAllowed(s.grants, anahtar) };
}

const json = (status: number, mesaj: string) => Response.json({ mesaj }, { status });

/**
 * BFF ucu koruyucusu: oturum + yetki anahtarı (+ değişiklikte CSRF ve aynı köken). Başarısızlıkta hazır yanıt döner.
 * Kullanım: `const k = await apiIzni(req, 'gorevler.create', true); if (k instanceof Response) return k;`
 */
export async function apiIzni(req: Request, anahtar: string, degisiklik = false): Promise<Session | Response> {
  if (degisiklik && !(await ayniKoken(req))) return json(403, 'İstek kaynağı doğrulanamadı.');
  const csrf = degisiklik ? (req.headers.get('x-csrf-token') ?? (await formAlani(req, 'csrf'))) : null;
  const r = authorize(await oturum(), anahtar, { mutating: degisiklik, csrf });
  if (r.ok) return r.value;
  if (r.error === 'oturum_yok') return json(401, 'Oturum gerekli.');
  if (r.error === 'csrf') return json(403, 'Güvenlik belirteci geçersiz; sayfayı yenileyin.');
  return json(403, 'Bu işlem için yetkiniz yok.');
}

async function formAlani(req: Request, ad: string): Promise<string | null> {
  const tur = req.headers.get('content-type') ?? '';
  if (!tur.includes('form')) return null;
  const v = (await req.clone().formData()).get(ad);
  return typeof v === 'string' ? v : null;
}

/** Değişiklik yapan istek aynı kökenden gelmeli (SameSite=Strict çereze ek savunma). */
export async function ayniKoken(req: Request): Promise<boolean> {
  const origin = req.headers.get('origin');
  const host = (await headers()).get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
