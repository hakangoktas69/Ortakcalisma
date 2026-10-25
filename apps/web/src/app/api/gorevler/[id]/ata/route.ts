import { assignTask } from '@eworks/workspace';
import { gorevHatasi } from '@/bff/gorevler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Görev ata (gorevler.assign): sorumlu ofisin iç kullanıcısı olmalı; atama denetim kaydına yazılır.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await apiIzni(req, 'gorevler.assign', true);
  if (s instanceof Response) return s;
  const { id } = await params;
  const g = await jsonGovde<{ assigneeId?: unknown; version?: unknown }>(req, 1024);
  if (!g || !Number.isInteger(g.version) || (g.assigneeId !== null && (typeof g.assigneeId !== 'string' || !/^[0-9a-f-]{36}$/.test(g.assigneeId)))) {
    return Response.json({ mesaj: 'İstek geçersiz.' }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) return gorevHatasi('bulunamadi');
  const r = await assignTask(baglam(s), id, g.version as number, (g.assigneeId as string | null) ?? null, konteyner().gorevler);
  return r.ok ? Response.json({ id }) : gorevHatasi(r.error);
}
