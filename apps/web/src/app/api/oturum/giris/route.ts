import { cookies } from 'next/headers';
import { login } from '@eworks/identity-access';
import { ayniKoken, cerezAdi, cerezAyari } from '@/bff/oturum.ts';
import { konteyner } from '@/bff/konteyner.ts';

// Giriş (01 §4): GoTrue belirteçleri sunucuda (Redis) kalır, tarayıcıya yalnız HttpOnly oturum çerezi gider.
// Form gönderimi; yanıt 303 yönlendirme. Hata nedeni ayrıntılandırılmaz (kullanıcı adı numaralandırması olmasın).
const git = (yer: string) => new Response(null, { status: 303, headers: { Location: yer } });

export async function POST(req: Request) {
  if (!(await ayniKoken(req))) return git('/giris?hata=kaynak');
  const form = await req.formData();
  const r = await login({ email: String(form.get('eposta') ?? ''), password: String(form.get('parola') ?? '') }, konteyner());
  if (!r.ok) return git(`/giris?hata=${r.error === 'eksik_bilgi' ? 'eksik' : 'giris'}`);
  (await cookies()).set(cerezAdi(), r.value.sessionId, cerezAyari());
  return git('/');
}
