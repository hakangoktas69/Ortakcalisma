import { requestCalendarJob } from '@eworks/sync';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// "Takvimi kaynaklardan güncelle" (genel_bakis.takvim.sync): yılın GİB vergi takvimi (kamuya açık) ve resmî tatilleri işle
// çekilir; kurum hesabı kullanılmaz. Süren iş varsa aynısı döner (çift tıklama ikinci istek açmaz).
export async function POST(req: Request) {
  const s = await apiIzni(req, 'genel_bakis.takvim.sync', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ yil?: unknown }>(req, 256);
  if (!g || typeof g.yil !== 'number') return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  const r = await requestCalendarJob(baglam(s), g.yil, konteyner().isler, new Date());
  if (r.ok) return Response.json({ isId: r.value.jobId, mevcut: r.value.existing }, { status: r.value.existing ? 200 : 202 });
  return Response.json({ mesaj: r.error === 'gecersiz_yil' ? 'Geçerli bir yıl seçin.' : 'Takvim kısa süre önce güncellendi; daha sonra yeniden deneyin.' }, { status: 422 });
}
