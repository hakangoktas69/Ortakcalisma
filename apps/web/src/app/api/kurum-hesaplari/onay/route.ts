import { isAllowed } from '@eworks/identity-access';
import { recordConsent, revokeConsent } from '@eworks/credentials';
import { bugun } from '@/bff/beyanname.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Mükellef onayı (firmalar.kurum_hesaplari.consent; D18, D46): kaydet (PUT) / geri al (DELETE). Onay müşavirin beyanıdır;
// veritabanı yetkiyi ve firma kapsamını yeniden denetler, işlemi denetim kaydına yazar.
const HATA = {
  yetki_yok: [403, 'Bu firma için mükellef onayı kaydetme yetkiniz yok.'],
  bulunamadi: [404, 'Firma ya da etkin onay bulunamadı.'],
  gecersiz: [422, 'Onay tarihi bugünden ileri olamaz; yöntem seçin.'],
  beyan_yok: [422, 'Mükelleften yazılı onay aldığınızı beyan edin.'],
} as const;
const UUID = /^[0-9a-f-]{36}$/;
const yanit = (r: { ok: true } | { ok: false; error: keyof typeof HATA }) =>
  r.ok ? Response.json({ durum: 'tamam' }) : Response.json({ mesaj: HATA[r.error][1] }, { status: HATA[r.error][0] });

export async function PUT(req: Request) {
  const s = await apiIzni(req, 'firmalar.kurum_hesaplari.consent', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ firmId?: unknown; method?: unknown; consentedOn?: unknown; attested?: unknown }>(req, 1024);
  if (!g || typeof g.firmId !== 'string' || !UUID.test(g.firmId) || typeof g.method !== 'string' || typeof g.consentedOn !== 'string') {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  const r = await recordConsent(baglam(s), { firmId: g.firmId, method: g.method, consentedOn: g.consentedOn, attested: g.attested === true }, (k) => isAllowed(s.grants, k), konteyner().onaylar, bugun());
  return yanit(r);
}

export async function DELETE(req: Request) {
  const s = await apiIzni(req, 'firmalar.kurum_hesaplari.consent', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ firmId?: unknown }>(req, 256);
  if (!g || typeof g.firmId !== 'string' || !UUID.test(g.firmId)) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  return yanit(await revokeConsent(baglam(s), g.firmId, (k) => isAllowed(s.grants, k), konteyner().onaylar));
}
