import { requestJob } from '@eworks/sync';
import { ISTEK_HATASI, musavirGibHesabi } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam } from '@/bff/oturum.ts';

// "GİB'den güncelle" (firmalar.gib_sozlesmeler.sync): müşavirin GİB hesabıyla sözleşme listesi işi kuyruğa alınır.
// İş ve kuyruk mesajı aynı işlemde yazılır; süren iş varsa aynı iş döner (çift tıklama yeni robot oturumu açmaz).
export async function POST(req: Request) {
  const s = await apiIzni(req, 'firmalar.gib_sozlesmeler.sync', true);
  if (s instanceof Response) return s;
  const ctx = baglam(s);
  const r = await requestJob(ctx, { kind: 'gib.sozlesmeler', account: await musavirGibHesabi(ctx) }, konteyner().isler);
  if (r.ok) return Response.json({ isId: r.value.jobId, mevcut: r.value.existing }, { status: r.value.existing ? 200 : 202 });
  const [durum, mesaj] = ISTEK_HATASI[r.error] ?? [400, 'İş başlatılamadı.'];
  return Response.json({ mesaj }, { status: durum });
}
