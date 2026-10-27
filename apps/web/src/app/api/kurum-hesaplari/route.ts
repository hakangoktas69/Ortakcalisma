import { saveAccount } from '@eworks/credentials';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Kurum hesabı kaydet (firmalar.kurum_hesaplari.edit_credentials): GİB, SGK (işyeri başına), UETS. Alanların hepsi yalnız
// Vault'a gider; yanıtta, günlükte, hata mesajında yer almaz. Yanıt yalnız durumdur (05 §4). Alan hataları yalnız alan adı + sabit metin.
type Govde = { ownerKind?: unknown; ownerId?: unknown; institution?: unknown; label?: unknown; fields?: unknown };

const metin = (v: unknown) => (typeof v === 'string' ? v : '');

export async function PUT(req: Request) {
  const s = await apiIzni(req, 'firmalar.kurum_hesaplari.edit_credentials', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<Govde>(req, 8 * 1024);
  if (!g || typeof g.ownerId !== 'string' || !/^[0-9a-f-]{36}$/.test(g.ownerId) || !g.fields || typeof g.fields !== 'object' || Array.isArray(g.fields)) {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  const r = await saveAccount(
    baglam(s),
    { ownerKind: metin(g.ownerKind), ownerId: g.ownerId, institution: metin(g.institution), label: metin(g.label), fields: Object.fromEntries(Object.entries(g.fields)) },
    konteyner().kurumHesaplari,
  );
  if (r.ok) return Response.json({ durum: 'Kayıtlı' });
  if (r.error === 'yetki_yok') return Response.json({ mesaj: 'Bu hesap için yetkiniz yok.' }, { status: 403 });
  if (r.error === 'bulunamadi') return Response.json({ mesaj: 'Hesap sahibi bulunamadı.' }, { status: 404 });
  return Response.json({ mesaj: 'Bilgileri kontrol edin.', alanlar: r.errors ?? [] }, { status: 422 });
}
