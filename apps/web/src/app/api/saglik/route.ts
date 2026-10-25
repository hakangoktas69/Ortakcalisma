import { konteyner } from '@/bff/konteyner.ts';

// Sağlık ucu (Compose/K8s): oturum deposu ve kontrol düzlemi erişilebilir mi. Ayrıntı dışarı verilmez.
export async function GET() {
  try {
    const k = konteyner();
    await Promise.all([k.redis.ping(), k.router.control.query('select 1')]);
    return Response.json({ durum: 'ok' });
  } catch {
    return Response.json({ durum: 'hata' }, { status: 503 });
  }
}
