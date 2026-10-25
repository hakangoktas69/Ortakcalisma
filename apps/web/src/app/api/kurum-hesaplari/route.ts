import { saveAccount, type SaveInput } from '@eworks/credentials';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Kurum hesabı kaydet (firmalar.kurum_hesaplari.edit_credentials). Şifre yalnız Vault'a gider; yanıtta, günlükte,
// hata mesajında yer almaz. Yanıt yalnız durumdur (05 §4, eski Edge Function'daki "status" davranışı).
export async function PUT(req: Request) {
  const s = await apiIzni(req, 'firmalar.kurum_hesaplari.edit_credentials', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<SaveInput>(req, 8 * 1024);
  if (!g || typeof g.username !== 'string' || typeof g.password !== 'string' || typeof g.ownerId !== 'string') {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  const r = await saveAccount(baglam(s), { ownerKind: g.ownerKind, ownerId: g.ownerId, institution: g.institution, username: g.username, password: g.password }, konteyner().kurumHesaplari);
  if (r.ok) return Response.json({ durum: 'Kayıtlı' });
  if (r.error === 'yetki_yok') return Response.json({ mesaj: 'Bu hesap için yetkiniz yok.' }, { status: 403 });
  if (r.error === 'bulunamadi') return Response.json({ mesaj: 'Hesap sahibi bulunamadı.' }, { status: 404 });
  return Response.json({ mesaj: 'Kullanıcı adı ve şifreyi kontrol edin.' }, { status: 422 });
}
