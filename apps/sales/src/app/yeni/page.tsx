import { DEFAULT_TRIAL_DAYS, MAX_TRIAL_DAYS, PLANS } from '@eworks/sales';
import { satisSayfaIzni } from '@/bff/oturum.ts';
import { YeniOfisFormu } from '@/features/sales/YeniOfisFormu.tsx';
import { Kabuk, Yasak } from '@/shared/ui/Kabuk.tsx';

// Yeni ofis (satis.ofis.create): ofis + yönetici müşavir + deneme lisansı birlikte açılır; geçici parola bir kez gösterilir.
export default async function YeniOfis() {
  const { oturum, izinli } = await satisSayfaIzni('satis.ofis.create');
  return (
    <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="yeni">
      {izinli ? (
        <>
          <div>
            <h1>Yeni ofis aç</h1>
            <p className="alt">Ofis, yöneticisi olan müşavir ve deneme lisansı birlikte açılır. Müşavir portala geçici parolayla girer.</p>
          </div>
          <YeniOfisFormu
            csrf={oturum.csrf}
            paketler={PLANS.map((p) => ({ key: p.key, ad: `${p.name} (${p.companyQuota} firma)` }))}
            varsayilanGun={DEFAULT_TRIAL_DAYS}
            enFazlaGun={MAX_TRIAL_DAYS}
          />
        </>
      ) : (
        <Yasak />
      )}
    </Kabuk>
  );
}
