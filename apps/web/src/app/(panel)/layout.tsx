import { redirect } from 'next/navigation';
import { oturum } from '@/bff/oturum.ts';
import { Kabuk } from '@/shared/ui/Kabuk.tsx';

export default async function PanelYerlesim({ children }: { children: React.ReactNode }) {
  const s = await oturum();
  if (!s) redirect('/giris');
  return <Kabuk oturum={s}>{children}</Kabuk>;
}
