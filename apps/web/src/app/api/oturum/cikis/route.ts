import { cookies } from 'next/headers';
import { logout } from '@eworks/identity-access';
import { apiIzni, cerezAdi } from '@/bff/oturum.ts';
import { konteyner } from '@/bff/konteyner.ts';

export async function POST(req: Request) {
  const k = await apiIzni(req, 'oturum.giris', true);
  if (k instanceof Response) return k;
  const c = await cookies();
  await logout(c.get(cerezAdi())?.value, konteyner());
  c.delete(cerezAdi());
  return new Response(null, { status: 303, headers: { Location: '/giris' } });
}
