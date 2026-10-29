import { redirect } from 'next/navigation';
import { oturum } from '@/bff/oturum.ts';
import { Kabuk } from '@/shared/ui/Kabuk.tsx';
import { isAllowed } from '@eworks/identity-access';
import { demoEnabled } from '@/shared/demo/model.ts';
import { demoCatalog } from '@/shared/demo/catalog.ts';
import { DemoRouter } from '@/shared/demo/DemoRouter.tsx';

export default async function PanelYerlesim({ children }: { children: React.ReactNode }) {
  const s = await oturum();
  if (!s) redirect('/giris');
  // Demo yalnız sentetik sunum alır: normal sayfa verileri istemci ağacına verilmez.
  // Kabul testi/TDD görünümünde ve diğer kiplerde asıl sayfalar değişmeden çalışır.
  if (demoEnabled(process.env)) {
    const pages = demoCatalog(k => isAllowed(s.grants, k));
    return <Kabuk oturum={s}><DemoRouter pages={pages} namespace={`${s.orgId}:${s.userId}`} /></Kabuk>;
  }
  return <Kabuk oturum={s}>{children}</Kabuk>;
}
