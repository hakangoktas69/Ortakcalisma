import { cookies } from 'next/headers';
import { salesLogin, STEP_TTL } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { adimCerezi, ayniKoken, cerezAyari, git } from '@/bff/oturum.ts';

// Satış girişi 1. adım (oturum öncesi; aynı köken denetimi): parola doğruysa kısa ömürlü ara adım çerezi, oturum açılmaz.
// Kurulu kullanıcı kod ekranına, ilk girişteki kullanıcı 2FA kurulumuna gider (2FA zorunlu).
export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return git('/giris?hata=kaynak');
  const form = await req.formData();
  try {
    const r = await salesLogin({ email: String(form.get('eposta') ?? '').slice(0, 254), password: String(form.get('parola') ?? '').slice(0, 128) }, konteyner().giris);
    // Kilitli hesap da aynı mesajı alır: mesaj farkı e-postanın kayıtlı olduğunu ele vermesin
    if (!r.ok) return git(`/giris?hata=${r.error === 'eksik_bilgi' ? 'eksik' : 'giris'}`);
    (await cookies()).set(adimCerezi(), r.value.stepId, cerezAyari(STEP_TTL[r.value.stage]));
    return git(r.value.stage === 'mfa' ? '/giris/dogrula' : '/giris/kurulum');
  } catch (e) {
    hataGunlugu('satis.oturum.giris', e);
    return git('/giris?hata=servis');
  }
}
