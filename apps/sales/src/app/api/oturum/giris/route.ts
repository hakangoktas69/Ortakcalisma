import { cookies } from 'next/headers';
import { salesLogin, SESSION_TTL, STEP_TTL } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { adimCerezi, ayniKoken, baslangicCerezi, cerezAyari, cerezSil, git, oturumCerezi } from '@/bff/oturum.ts';

// Satış girişi, parola adımı (başlangıç çereziyle; aynı köken): gerekiyorsa önce güvenlik kodu (tek kullanımlık), sonra parola.
// 2FA'lı hesap kod adımına (ara adım çerezi), 2FA'sız hesap doğrudan oturuma; geçici parolası olan önce parola ekranına.
export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return git('/giris?hata=kaynak');
  const c = await cookies();
  const startId = c.get(baslangicCerezi())?.value;
  if (!startId) return git('/giris?hata=sure');
  const form = await req.formData();
  try {
    const r = await salesLogin(
      { startId, password: String(form.get('parola') ?? '').slice(0, 128), captcha: String(form.get('kod') ?? '').slice(0, 10) },
      konteyner().giris,
    );
    if (!r.ok) {
      if (r.error === 'baslangic_yok') {
        cerezSil(c, baslangicCerezi());
        return git('/giris?hata=sure');
      }
      // Kilitli hesap da aynı mesajı alır: mesaj farkı e-postanın kayıtlı olduğunu ele vermesin
      return git(`/giris?hata=${r.error === 'kod_hatali' ? 'kod' : r.error === 'eksik_bilgi' ? 'eksik' : 'giris'}`);
    }
    cerezSil(c, baslangicCerezi());
    if (r.value.stage === 'mfa') {
      c.set(adimCerezi(), r.value.stepId, cerezAyari(STEP_TTL.mfa));
      return git('/giris/dogrula');
    }
    c.set(oturumCerezi(), r.value.sessionId, cerezAyari(SESSION_TTL));
    return git(r.value.mustChangePassword ? '/sifre' : '/');
  } catch (e) {
    hataGunlugu('satis.oturum.giris', e);
    return git('/giris?hata=servis');
  }
}
