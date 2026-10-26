import { cookies } from 'next/headers';
import { SESSION_TTL, verifySecondFactor } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { adimCerezi, ayniKoken, cerezAyari, cerezSil, git, oturumCerezi } from '@/bff/oturum.ts';

// Satış girişi 2. adım (ara adım çereziyle; aynı köken denetimi): kod ya da kurtarma kodu doğruysa oturum çerezi verilir,
// ara adım silinir. Geçici parolası olan kullanıcı önce parola ekranına gider.
export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return git('/giris?hata=kaynak');
  const c = await cookies();
  const adim = c.get(adimCerezi())?.value;
  if (!adim) return git('/giris?hata=sure');
  const form = await req.formData();
  const kurtarma = String(form.get('kurtarma') ?? '').slice(0, 20).trim();
  try {
    const r = await verifySecondFactor(adim, kurtarma ? { recoveryCode: kurtarma } : { code: String(form.get('kod') ?? '').slice(0, 6) }, konteyner().giris);
    if (!r.ok) {
      if (r.error === 'kod_hatali' && (await konteyner().giris.sessions.get(adim))) return git('/giris/dogrula?hata=kod');
      cerezSil(c, adimCerezi());
      return git('/giris?hata=sure');
    }
    cerezSil(c, adimCerezi());
    c.set(oturumCerezi(), r.value.sessionId, cerezAyari(SESSION_TTL));
    return git(r.value.mustChangePassword ? '/sifre' : '/');
  } catch (e) {
    hataGunlugu('satis.oturum.dogrula', e);
    return git('/giris?hata=servis');
  }
}
