import { isAllowed } from '@eworks/identity-access';
import { createTask } from '@eworks/workspace';
import { gorevHatasi } from '@/bff/gorevler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const uuidYa = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

// Yeni görev (gorevler.create). Başkasına atamak gorevler.assign ister; firma kapsam dışıysa RLS reddeder.
export async function POST(req: Request) {
  const s = await apiIzni(req, 'gorevler.create', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ title?: unknown; firmId?: unknown; dueOn?: unknown; assigneeId?: unknown }>(req, 4096);
  if (!g) return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  try {
    const r = await createTask(
      baglam(s),
      { title: String(g.title ?? ''), firmId: uuidYa(g.firmId), dueOn: String(g.dueOn ?? ''), assigneeId: uuidYa(g.assigneeId) },
      (k) => isAllowed(s.grants, k),
      konteyner().gorevler,
    );
    return r.ok ? Response.json({ id: r.value.id }, { status: 201 }) : gorevHatasi(r.error, r.errors);
  } catch {
    // Kapsam dışı firma (RLS ihlali) → firma bulunamadı gibi
    return Response.json({ mesaj: 'Firma bulunamadı.' }, { status: 404 });
  }
}
