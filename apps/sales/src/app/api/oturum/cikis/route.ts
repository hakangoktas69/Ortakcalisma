import { cookies } from 'next/headers';
import { salesLogout } from '@eworks/sales';
import { konteyner } from '@/bff/konteyner.ts';
import { cerezSil, git, oturumCerezi, satisApiIzni } from '@/bff/oturum.ts';

// Çıkış (CSRF belirteçli form): oturum Redis'ten silinir, çerez kaldırılır.
export async function POST(req: Request) {
  const s = await satisApiIzni(req, 'satis.oturum', true);
  if (s instanceof Response) return s;
  const c = await cookies();
  await salesLogout(c.get(oturumCerezi())?.value, konteyner().giris);
  cerezSil(c, oturumCerezi());
  return git('/giris');
}
