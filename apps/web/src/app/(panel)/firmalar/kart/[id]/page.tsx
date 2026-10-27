import { notFound } from 'next/navigation';
import { accountStatuses, CONSENT_METHODS, consentStatus, INSTITUTION_FORMS, liveStatus, liveStatusLabel, statusLabel, type AccountStatus, type Institution } from '@eworks/credentials';
import { isAllowed } from '@eworks/identity-access';
import { getFirm } from '@eworks/portfolio';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { KurumHesabiFormu } from '@/features/credentials/KurumHesabiFormu.tsx';
import { MukellefOnayi } from '@/features/credentials/MukellefOnayi.tsx';
import { bugun } from '@/bff/beyanname.ts';
import { ArsivDugmesi } from '@/features/portfolio/ArsivDugmesi.tsx';
import { FirmaFormu } from '@/features/portfolio/FirmaFormu.tsx';
import { FeatureBadge, FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

const MESAJ: Record<string, string> = { eklendi: 'Firma eklendi.', guncellendi: 'Firma bilgileri kaydedildi.' };
const formu = (k: Institution) => INSTITUTION_FORMS.find((f) => f.institution === k)!;
const tarih = (iso: string) => new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
const canliSinif = { active: 'iyi', inactive: 'kotu', unknown: '' } as const;

/** Hesap durumu (kayıt) + kurumda doğrulanma (canlı): şifrenin kayıtlı olması doğrulama sayılmaz. */
function HesapDurumu({ ad, h }: { ad: string; h: AccountStatus | undefined }) {
  const canli = liveStatus(h);
  return (
    <>
      <p>
        {ad}: <span className={`etiket ${h?.status === 'active' ? 'iyi' : h ? 'kotu' : ''}`}>{statusLabel(h)}</span>
        {h ? <span className="alt"> · son güncelleme {tarih(h.updatedAt)}</span> : null}
      </p>
      <p>
        Kurumda: <span className={`etiket ${canliSinif[canli.state]}`}>{liveStatusLabel(canli.state)}</span>
      </p>
    </>
  );
}

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
  const hesaplar = await accountStatuses(ctx, k.kurumHesaplari, { kind: 'firm', id });
  const gib = hesaplar.find((h) => h.institution === 'GIB');
  const uets = hesaplar.find((h) => h.institution === 'UETS');
  const sgk = hesaplar.filter((h) => h.institution === 'SGK');
  const onay = await consentStatus(ctx, id, k.onaylar);
  const duzenler = isAllowed(oturum.grants, 'firmalar.kurum_hesaplari.edit_credentials');
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
      <section className="kurum-kartlari-bolumu" aria-labelledby="kurum-bilgileri">
        <h2 id="kurum-bilgileri">Kurum ve mükellef bilgileri</h2>
        <p className="alt">Kullanıcı adı, kod ve şifreler yalnız Vault&apos;ta saklanır; bu ekrana hiçbir zaman geri gelmez. Şifreleri başka alanlara yazmayın.</p>
        <ul className="kurum-kartlari">
          <li className="kart kurum-karti">
            <h3>GİB bilgileri</h3>
            <HesapDurumu ad="GİB hesabı durumu" h={gib} />
            {duzenler ? (
              <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
                <KurumHesabiFormu
                  csrf={oturum.csrf}
                  sahip="firm"
                  sahipId={f.id}
                  baslik="Firma GİB hesabı"
                  aciklama="Yalnızca bu firmanın GİB hesabını girin. Bilgiler Vault'a kaydedilir; şifre bir daha görüntülenemez."
                  kayitli={!!gib}
                  form={formu('GIB')}
                />
              </FeatureGate>
            ) : null}
            {izin('firmalar.kurum_hesaplari.consent') ? (
              <FeatureGate k="firmalar.kurum_hesaplari.consent">
                <MukellefOnayi
                  csrf={oturum.csrf}
                  firmId={f.id}
                  durum={onay ? { active: onay.active, consentedOn: onay.consentedOn, methodTitle: CONSENT_METHODS.find((m) => m.id === onay.method)?.title ?? onay.method } : null}
                  yontemler={CONSENT_METHODS}
                  bugun={bugun()}
                />
              </FeatureGate>
            ) : onay?.active ? (
              <p>
                Mükellef onayı: <span className="etiket iyi">Var</span>
              </p>
            ) : null}
          </li>
          <li className="kart kurum-karti">
            <h3>SGK işyerleri</h3>
            {sgk.length === 0 ? <p className="alt">Kayıtlı SGK işyeri hesabı yok.</p> : null}
            {sgk.map((h) => (
              <div key={h.id} className="kurum-alt" data-isyeri={h.label}>
                <HesapDurumu ad={h.label} h={h} />
                {duzenler ? (
                  <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
                    <KurumHesabiFormu
                      csrf={oturum.csrf}
                      sahip="firm"
                      sahipId={f.id}
                      baslik={`${h.label} işyeri hesabı`}
                      aciklama="Kullanıcı adı, işyeri kodu, sistem ve işyeri şifresi birlikte güncellenir."
                      kayitli
                      form={formu('SGK')}
                      etiket={h.label}
                      acmaMetni={`${h.label} bilgilerini değiştir`}
                    />
                  </FeatureGate>
                ) : null}
              </div>
            ))}
            {duzenler ? (
              <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
                <KurumHesabiFormu
                  csrf={oturum.csrf}
                  sahip="firm"
                  sahipId={f.id}
                  baslik="Yeni SGK işyeri"
                  aciklama="Her işyerinin e-Bildirge girişi ayrıdır. İşyerine tanıyacağınız bir ad verin (ör. Merkez, Şube)."
                  kayitli={false}
                  form={formu('SGK')}
                  acmaMetni="SGK işyeri ekle"
                />
              </FeatureGate>
            ) : null}
            <p className="alt">SGK sistemleriyle entegrasyon henüz bağlı değil; bilgiler bağlandığında kullanılır.</p>
          </li>
          <li className="kart kurum-karti">
            <h3>UETS bilgileri</h3>
            <HesapDurumu ad="UETS hesabı durumu" h={uets} />
            {duzenler ? (
              <FeatureGate k="firmalar.kurum_hesaplari.edit_credentials">
                <KurumHesabiFormu
                  csrf={oturum.csrf}
                  sahip="firm"
                  sahipId={f.id}
                  baslik="Firma UETS hesabı"
                  aciklama="UETS adresi ve şifresi Vault'a kaydedilir."
                  kayitli={!!uets}
                  form={formu('UETS')}
                />
              </FeatureGate>
            ) : null}
          </li>
          <li className="kart kurum-karti">
            <h3>e-Devlet bilgileri</h3>
            <p>e-Devlet şifresi Eworks&apos;te saklanmaz.</p>
            <p className="alt">e-Devlet şifresi kişiye özeldir; başkasıyla paylaşılması kullanım koşullarına aykırıdır. Mükellef e-Devlet işlemlerini kendi girişiyle yapar.</p>
          </li>
          <li className="kart kurum-karti">
            <h3>Mükellef portal girişi</h3>
            <p>
              Mükellefin Eworks&apos;e girişi <strong>Yönetim › Mükellef kullanıcıları</strong> ekranından açılır. <FeatureBadge k="yonetim.mukellef_kullanicilari" kucuk />
            </p>
            <p className="alt">Mükellef yalnız kendi firmasını görür; parolasını kendisi belirler, Eworks parolayı göstermez.</p>
          </li>
          <li className="kart kurum-karti">
            <h3>Durum bilgileri</h3>
            <dl className="bilgi-listesi">
              <dt>Onay durumu</dt>
              <dd>{f.status}</dd>
              <dt>Kaynak</dt>
              <dd>{f.source === 'gib_contract' ? 'GİB sözleşme listesinden açıldı' : 'Elle eklendi'}</dd>
            </dl>
          </li>
          <li className="kart kurum-karti">
            <h3>e-Belge durumları</h3>
            <p className="alt">e-Fatura, e-İrsaliye ve e-Defter mükellefiyeti henüz kurumdan okunmuyor; kaynak bağlanınca burada görünür.</p>
          </li>
          <li className="kart kurum-karti">
            <h3>Sistem bilgileri</h3>
            <dl className="bilgi-listesi">
              <dt>Kayıt kimliği</dt>
              <dd className="kirilir">{f.id}</dd>
              <dt>Müşavir</dt>
              <dd>{f.advisorName}</dd>
              <dt>Son güncelleme</dt>
              <dd>{f.updatedAt ? tarih(f.updatedAt) : '—'}</dd>
            </dl>
          </li>
        </ul>
      </section>
    </>
  );
}
