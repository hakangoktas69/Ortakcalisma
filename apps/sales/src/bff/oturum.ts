import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { authorizeSales, currentSalesSession, type SalesPrincipal } from '@eworks/sales';
import { konteyner } from './konteyner.ts';

// Satış oturumu ve yetki koruyucusu. Portal ile aynı kalıp (HttpOnly + SameSite=Strict çerez, değişiklikte CSRF + aynı köken),
// ama ayrı çerez adları ve ayrı kimlik: satış çerezi portalda, portal çerezi burada geçmez.
// İki çerez: ara adım (parola doğru, kod bekleniyor; ≤ 15 dk) ve oturum (8 saat).

const guvenli = () => konteyner().config.COOKIE_SECURE;
/** `__Host-` öneki yalnız Secure çerezde geçerlidir; http üzerindeki demo/geliştirme yığınında sade ad. */
export const oturumCerezi = () => (guvenli() ? '__Host-ew_satis_sid' : 'ew_satis_sid');
export const adimCerezi = () => (guvenli() ? '__Host-ew_satis_adim' : 'ew_satis_adim');

export const cerezAyari = (saniye: number) => ({ httpOnly: true, secure: guvenli(), sameSite: 'strict' as const, path: '/', maxAge: saniye });

export async function satisOturumu(): Promise<SalesPrincipal | null> {
  return currentSalesSession((await cookies()).get(oturumCerezi())?.value, konteyner().giris);
}

/** Sayfa koruyucusu: oturum yoksa girişe; geçici parolası olan önce parola ekranına; yetki yoksa `izinli: false`. */
export async function satisSayfaIzni(anahtar: string): Promise<{ oturum: SalesPrincipal; izinli: boolean }> {
  const s = await satisOturumu();
  const r = authorizeSales(s, anahtar);
  if (!s) redirect('/giris');
  if (!r.ok && r.error === 'parola_degismeli') redirect('/sifre');
  return { oturum: s, izinli: r.ok };
}

const json = (status: number, mesaj: string) => Response.json({ mesaj }, { status });

/**
 * BFF ucu koruyucusu: oturum + yetki anahtarı (+ değişiklikte CSRF ve aynı köken). Başarısızlıkta hazır yanıt döner.
 * Kullanım: `const s = await satisApiIzni(req, 'satis.ofis.create', true); if (s instanceof Response) return s;`
 */
export async function satisApiIzni(req: Request, anahtar: string, degisiklik = false): Promise<SalesPrincipal | Response> {
  if (degisiklik && !(await ayniKoken(req))) return json(403, 'İstek kaynağı doğrulanamadı.');
  const csrf = degisiklik ? (req.headers.get('x-csrf-token') ?? (await formAlani(req, 'csrf'))) : null;
  const r = authorizeSales(await satisOturumu(), anahtar, { mutating: degisiklik, csrf });
  if (r.ok) return r.value;
  if (r.error === 'oturum_yok') return json(401, 'Oturum gerekli.');
  if (r.error === 'csrf') return json(403, 'Güvenlik belirteci geçersiz; sayfayı yenileyin.');
  if (r.error === 'parola_degismeli') return json(403, 'Önce geçici parolanızı değiştirin.');
  return json(403, 'Bu işlem için yetkiniz yok.');
}

async function formAlani(req: Request, ad: string): Promise<string | null> {
  if (!(req.headers.get('content-type') ?? '').includes('form')) return null;
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

/** JSON gövdeyi boyut sınırıyla okur. */
export async function jsonGovde<T>(req: Request, sinir = 16 * 1024): Promise<T | null> {
  const metin = await req.text();
  if (metin.length > sinir) return null;
  try {
    return JSON.parse(metin) as T;
  } catch {
    return null;
  }
}

/** Form gönderiminin sonucu: 303 ile sayfaya dön (tarayıcı geri tuşunda formu yeniden göndermez). */
export const git = (yer: string) => new Response(null, { status: 303, headers: { Location: yer } });
