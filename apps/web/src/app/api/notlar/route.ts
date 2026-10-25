import { addNote } from '@eworks/workspace';
import { konteyner } from '@/bff/konteyner.ts';
import { apiIzni, baglam, jsonGovde } from '@/bff/oturum.ts';

// Not ekle (notlar.create): firmaya bağlı; notlar değiştirilmez/silinmez. Kapsam dışı firma RLS ile reddedilir (404).
export async function POST(req: Request) {
  const s = await apiIzni(req, 'notlar.create', true);
  if (s instanceof Response) return s;
  const g = await jsonGovde<{ firmId?: unknown; body?: unknown }>(req, 8 * 1024);
  if (!g || typeof g.firmId !== 'string' || !/^[0-9a-f-]{36}$/.test(g.firmId) || typeof g.body !== 'string') {
    return Response.json({ mesaj: 'Firma ve not metni gerekli.' }, { status: 400 });
  }
  try {
    const r = await addNote(baglam(s), g.firmId, g.body, konteyner().notlar);
    return r.ok ? Response.json({ id: r.value.id }, { status: 201 }) : Response.json({ mesaj: 'Not 1–2000 karakter olmalı.' }, { status: 422 });
  } catch {
    return Response.json({ mesaj: 'Firma bulunamadı.' }, { status: 404 });
  }
}
