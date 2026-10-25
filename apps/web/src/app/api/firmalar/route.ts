import { createFirm, type FirmInput } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Yeni firma (firmalar.kart.create). VKN sistem genelinde tekil (07 §2.2); hata mesajları kişisel veri içermez.
export async function POST(req: Request) {
  const s = await apiIzni(req, 'firmalar.kart.create', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<FirmInput>(req);
  if (!g || typeof g.title !== 'string' || typeof g.taxId !== 'string') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const r = await createFirm(baglam(s), g, konteyner().firmalar);
  if (r.ok) return Response.json(r.value, { status: 201 });
  if (r.error === 'gecersiz') return Response.json({ mesaj: 'Bilgileri kontrol edin.', alanlar: r.errors }, { status: 422 });
  if (r.error === 'vkn_kayitli') return Response.json({ mesaj: 'Bu VKN/TCKN ile kayıtlı bir mükellef zaten var.' }, { status: 409 });
  if (r.error === 'musavir_yok') return Response.json({ mesaj: 'Firma eklemek için müşavir kaydınız olmalı.' }, { status: 403 });
  return Response.json({ mesaj: 'Firma eklenemedi.' }, { status: 400 });
}
