import { cookies } from 'next/headers';
import { beginLogin, START_TTL } from '@eworks/sales';
import { hataGunlugu } from '@/bff/gunluk.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { ayniKoken, baslangicCerezi, cerezAyari, git } from '@/bff/oturum.ts';

// Satış girişi, e-posta adımı (oturum öncesi; aynı köken): güvenlik kodunun gerekip gerekmediği sunucuda karara bağlanır ve
// kısa ömürlü başlangıç kaydına yazılır (D41). Parola burada denenmez.
export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return git('/giris?hata=kaynak');
  const form = await req.formData();
  try {
    const r = await beginLogin(String(form.get('eposta') ?? ''), konteyner().giris);
    if (!r.ok) return git('/giris?yeni=1&hata=eksik');
    (await cookies()).set(baslangicCerezi(), r.value.startId, cerezAyari(START_TTL));
    return git('/giris');
  } catch (e) {
    hataGunlugu('satis.oturum.baslat', e);
    return git('/giris?yeni=1&hata=servis');
  }
}
