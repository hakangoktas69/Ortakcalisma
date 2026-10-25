import { requestJob } from '@eworks/sync';
import { syncScope } from '@eworks/tax-filing';
import { bugun, kapsamFirmasi } from '@/bff/beyanname.ts';
import { ISTEK_HATASI, musavirGibHesabi } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Beyanname senkronu (beyanname.senkron.start): müşavirin GİB hesabıyla, seçilen gönderim ayları için. Robot önce aynı oturumda
// sözleşme listesini okur; yalnız Aracılık ve Sorumluluk sözleşmeli mükellefleri sorgular (kurum incelemesi kuralı).
export async function POST(req: Request) {
  const s = await apiIzni(req, 'beyanname.senkron.start', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ bas?: unknown; bit?: unknown; firmaId?: unknown }>(req, 2048);
  if (!g || typeof g.bas !== 'string' || typeof g.bit !== 'string' || (g.firmaId != null && (typeof g.firmaId !== 'string' || !UUID.test(g.firmaId)))) {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  const kapsam = syncScope(g.bas, g.bit, bugun());
  if (!kapsam.ok) return Response.json({ mesaj: 'Geçerli bir ay aralığı seçin (en çok 12 ay, gelecek olmadan).' }, { status: 422 });
  const ctx = baglam(s);
  const params: Record<string, unknown> = { startDate: kapsam.startDate, endDate: kapsam.endDate };
  if (g.firmaId) {
    const f = await kapsamFirmasi(ctx, g.firmaId);
    if (!f) return Response.json({ mesaj: 'Bu mükellef için geçerli Aracılık ve Sorumluluk sözleşmesi yok; beyannameleri sorgulanamaz.' }, { status: 422 });
    params['identities'] = [f.taxId];
  }
  const r = await requestJob(ctx, { kind: 'gib.beyannameler', account: await musavirGibHesabi(ctx), params }, konteyner().isler);
  if (r.ok) return Response.json({ isId: r.value.jobId, mevcut: r.value.existing }, { status: r.value.existing ? 200 : 202 });
  const [durum, mesaj] = ISTEK_HATASI[r.error] ?? [400, 'İş başlatılamadı.'];
  return Response.json({ mesaj }, { status: durum });
}
