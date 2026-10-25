import { notFound } from 'next/navigation';
import { accountStatuses, statusLabel } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { getFirm } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { KurumHesabiFormu } from '@/features/credentials/KurumHesabiFormu.tsx';
import { ArsivDugmesi } from '@/features/portfolio/ArsivDugmesi.tsx';
import { FirmaFormu } from '@/features/portfolio/FirmaFormu.tsx';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

const MESAJ: Record<string, string> = { eklendi: 'Firma eklendi.', guncellendi: 'Firma bilgileri kaydedildi.' };

export default async function FirmaKarti({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { oturum, izinli } = await sayfaIzni('firmalar.kart.view');
  if (!izinli) return <Yasak />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = baglam(oturum);
  const k = konteyner();
  // Başka ofisin ya da kapsam dışındaki firma RLS ile görünmez → 404 (varlığı da sızdırılmaz)
  const f = await getFirm(ctx, id, k.firmalar);
  if (!f || f.archivedAt) notFound();
  const { ok } = await searchParams;
  const gib = (await accountStatuses(ctx, k.kurumHesaplari, { kind: 'firm', id })).find((h) => h.institution === 'GIB');
  const izin = (key: string) => isAllowed(oturum.grants, key);
  return (
    <>
      <Baslik k="firmalar.kart" alt={`${f.title} · ${f.kind} · Müşavir: ${f.advisorName}`}>
        {izin('firmalar.kart.archive') ? (
          <FeatureGate k="firmalar.kart.archive">
            <ArsivDugmesi csrf={oturum.csrf} id={f.id} />
          </FeatureGate>
        ) : null}
      </Baslik>
      {ok && MESAJ[ok] ? (
        <p className="basari" role="status">
          {MESAJ[ok]}
        </p>
      ) : null}
      {izin('firmalar.kart.edit') ? (
        <FeatureGate k="firmalar.kart.edit">
          <FirmaFormu
            csrf={oturum.csrf}
            id={f.id}
            version={f.version}
            ilk={{
              title: f.title,
              kind: f.kind,
              taxId: f.taxId,
              taxOffice: f.taxOffice ?? '',
              city: f.city ?? '',
              representative: f.representative ?? '',
              phone: f.phone ?? '',
              email: f.email ?? '',
              activityCode: f.activityCode ?? '',
              activityName: f.activityName ?? '',
              taxRegime: f.taxRegime,
              status: f.status,
              groupName: f.groupName ?? '',
            }}
          />
        </FeatureGate>
      ) : (
        <section className="kart">
          <dl className="sayaclar">
            {[
              ['VKN / TCKN', f.taxId],
              ['Vergi dairesi', f.taxOffice],
              ['İl', f.city],
              ['Yetkili', f.representative],
              ['Vergilendirme', f.taxRegime],
              ['Onay durumu', f.status],
            ].map(([ad, v]) => (
              <div key={ad} className="sayac">
                <span>{ad}</span>
                <strong>{v ?? '—'}</strong>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className="kart">
        <p>
          GİB hesabı durumu: <span className={`etiket ${gib?.status === 'active' ? 'iyi' : gib ? 'kotu' : ''}`}>{statusLabel(gib)}</span>
          {gib ? <span className="alt"> · son güncelleme {new Date(gib.updatedAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</span> : null}
        </p>
        {izin('firmalar.kurum_hesaplari.edit_credentials') ? (
          <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
            <KurumHesabiFormu
              csrf={oturum.csrf}
              sahip="firm"
              sahipId={f.id}
              baslik="Firma GİB hesabı"
              aciklama="Yalnızca bu firmanın GİB hesabını girin. Bilgiler Vault'a kaydedilir; şifre bir daha görüntülenemez."
            />
          </FeatureGate>
        ) : null}
      </section>
    </>
  );
}
