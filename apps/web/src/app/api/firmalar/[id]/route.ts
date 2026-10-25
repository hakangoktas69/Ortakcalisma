import { updateFirm, type FirmInput } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Firma kartı güncelleme (firmalar.kart.edit). İyimser kilit: istemcinin gördüğü sürüm değiştiyse 409.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'firmalar.kart.edit', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  const g = await jsonGovde<FirmInput & { version: number }>(req);
  if (!UUID.test(id) || !g || typeof g.title !== 'string' || typeof g.taxId !== 'string' || !Number.isInteger(g.version)) {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  const r = await updateFirm(baglam(s), id, g.version, g, konteyner().firmalar);
  if (r.ok) return Response.json(r.value);
  if (r.error === 'gecersiz') return Response.json({ mesaj: 'Bilgileri kontrol edin.', alanlar: r.errors }, { status: 422 });
  if (r.error === 'vkn_kayitli') return Response.json({ mesaj: 'Bu VKN/TCKN ile kayıtlı bir mükellef zaten var.' }, { status: 409 });
  if (r.error === 'catisma') return Response.json({ mesaj: 'Kart siz düzenlerken değişti; sayfayı yenileyin.' }, { status: 409 });
  return Response.json({ mesaj: 'Firma bulunamadı.' }, { status: 404 });
}
