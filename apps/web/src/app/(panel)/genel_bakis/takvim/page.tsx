import Link from 'next/link';
import { isAllowed } from '@eworks/identity-access';
import { listFirms, normalizeSearch } from '@eworks/portfolio';
import { latestJobs } from '@eworks/sync';
import {
  CALENDAR_CATEGORIES,
  CALENDAR_SOURCES,
  listCalendar,
  listReminders,
  REMINDER_CATEGORIES,
  upcomingReminders,
  type CalendarCategory,
  type CalendarSource,
  type Reminder,
  type ViewEntry,
} from '@eworks/workspace';
import { bugun } from '@/bff/beyanname.ts';
import { isGorunumu } from '@/bff/isler.ts';
import { konteyner } from '@/bff/konteyner.ts';
import { baglam, sayfaIzni } from '@/bff/oturum.ts';
import { TakvimGuncelle } from '@/features/sync/TakvimGuncelle.tsx';
import { HatirlatmaFormu, HatirlatmaIslemleri } from '@/features/workspace/Hatirlatma.tsx';
import { TakvimDuzelt } from '@/features/workspace/TakvimDuzelt.tsx';
import { araligi, ayAdi, ayIzgarasi, GORUNUMLER, gorunumOku, GUNLER, haftaGunleri, haftaSonu, kaydir, uzunTarih } from '@/features/workspace/takvimIzgara.ts';
import { FeatureGate } from '@/shared/ui/FeatureBadge.tsx';
import { Baslik, Yasak } from '@/shared/ui/Sayfa.tsx';

// Mali müşavir takvimi (genel_bakis.takvim; Mert 26.10): GİB vergi takvimi, resmî tatiller ve bayramlar, mevzuat kuralından
// hesaplanan tarihler (SGK prim son günü), dönem sonları ve kişisel hatırlatmalar. Ay / hafta / gün / yıl / liste görünümü,
// kaynak ve kategori süzgeci. Kesinleşmemiş tarih açıkça işaretlenir; GİB tarihleri genel yükümlülüktür.

type Ara = { gorunum?: string; tarih?: string; kaynak?: string | string[]; kategori?: string | string[]; q?: string; hatirlat?: string };
const dizi = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const KAT = new Map(CALENDAR_CATEGORIES.map((k) => [k.id, k.title]));
const KAYNAK = new Map(CALENDAR_SOURCES.map((k) => [k.id, k.title]));
const HKAT = new Map<string, string>(REMINDER_CATEGORIES.map((k) => [k.id, k.title]));
const KISISEL = 'kisisel';
const AYIN_ILK_UC = 3;
const tr = (t: string) => t.split('-').reverse().join('.');

function Kayit({ e, kisa = false }: { e: ViewEntry; kisa?: boolean }) {
  return (
    <span className={`takvim-kayit kat-${e.category}`} title={`${KAT.get(e.category)}: ${e.title}`}>
      <span className="gorunmez">{KAT.get(e.category)}: </span>
      {kisa && e.title.length > 34 ? `${e.title.slice(0, 32)}…` : e.title}
      {e.certainty === 'kesinlesmedi' ? (
        <>
          <span aria-hidden="true"> ≈</span>
          <span className="gorunmez"> (kesinleşmedi)</span>
        </>
      ) : null}
    </span>
  );
}

function HatirlatmaEtiketi({ h }: { h: Reminder }) {
  return (
    <span className={`takvim-kayit kat-kisisel ${h.done ? 'tamam' : ''}`} title={`Kişisel hatırlatma: ${h.title}`}>
      <span className="gorunmez">Kişisel hatırlatma: </span>
      {h.remindTime ? `${h.remindTime} ` : ''}
      {h.title}
      {h.done ? <span className="gorunmez"> (tamamlandı)</span> : null}
    </span>
  );
}

export default async function Takvim({ searchParams }: { searchParams: Promise<Ara> }) {
  const { oturum, izinli } = await sayfaIzni('genel_bakis.takvim.view');
  if (!izinli) return <Yasak />;
  const a = await searchParams;
  const ctx = baglam(oturum);
  const k = konteyner();
  const bu = bugun();
  const { gorunum, tarih } = gorunumOku(a, bu);
  const secilenKaynak = dizi(a.kaynak).filter((x) => x === KISISEL || KAYNAK.has(x as CalendarSource));
  const kaynaklar = secilenKaynak.filter((x): x is CalendarSource => KAYNAK.has(x as CalendarSource));
  const kategoriler = dizi(a.kategori).filter((x): x is CalendarCategory => KAT.has(x as CalendarCategory));
  const q = normalizeSearch((a.q ?? '').slice(0, 100));
  const { from, to } = araligi(gorunum, tarih);
  const hatirlatir = isAllowed(oturum.grants, 'genel_bakis.takvim.remind');
  const duzeltir = isAllowed(oturum.grants, 'genel_bakis.takvim.edit');
  const gunceller = isAllowed(oturum.grants, 'genel_bakis.takvim.sync');
  const [r, hr, yaklasan, firmalar, sonIs] = await Promise.all([
    listCalendar(ctx, from, to, k.takvim),
    listReminders(ctx, from, to, k.hatirlatmalar),
    upcomingReminders(ctx, bu, k.hatirlatmalar),
    hatirlatir ? listFirms(ctx, {}, k.firmalar) : Promise.resolve([]),
    gunceller ? latestJobs(ctx, 'takvim.kaynaklar', k.isler, 1) : Promise.resolve([]),
  ]);
  const hepsi = r.ok ? r.value : [];
  const kayitlar = hepsi.filter(
    (e) =>
      (secilenKaynak.length === 0 || kaynaklar.includes(e.source)) &&
      (kategoriler.length === 0 || kategoriler.includes(e.category)) &&
      (!q || normalizeSearch(`${e.title} ${e.description} ${e.period ?? ''}`).includes(q)),
  );
  const hatirlatmalar = (hr.ok ? hr.value : []).filter(
    (h) => (secilenKaynak.length === 0 || secilenKaynak.includes(KISISEL)) && kategoriler.length === 0 && (!q || normalizeSearch(`${h.title} ${h.note ?? ''}`).includes(q)),
  );
  const gunun = (t: string) => kayitlar.filter((e) => e.date === t);
  const gununH = (t: string) => hatirlatmalar.filter((h) => h.remindOn === t);
  const tatil = (t: string) => hepsi.some((e) => e.date === t && e.category === 'tatil' && !e.halfDay);
  const kaynakKaydi = a.hatirlat ? hepsi.find((e) => e.key === a.hatirlat) : undefined;

  const sorgu = (deg: Partial<Record<'gorunum' | 'tarih' | 'hatirlat', string>>) => {
    const p = new URLSearchParams();
    p.set('gorunum', deg.gorunum ?? gorunum);
    p.set('tarih', deg.tarih ?? tarih);
    for (const x of secilenKaynak) p.append('kaynak', x);
    for (const x of kategoriler) p.append('kategori', x);
    if (a.q) p.set('q', a.q.slice(0, 100));
    if (deg.hatirlat) p.set('hatirlat', deg.hatirlat);
    return `/genel_bakis/takvim?${p}`;
  };
  const baslik =
    gorunum === 'ay' || gorunum === 'liste' ? ayAdi(tarih) : gorunum === 'yil' ? tarih.slice(0, 4) : gorunum === 'gun' ? uzunTarih(tarih) : `${uzunTarih(from)} – ${uzunTarih(to)}`;
  const listeGunleri = gorunum === 'gun' ? [tarih] : [...new Set([...kayitlar.map((e) => e.date), ...hatirlatmalar.map((h) => h.remindOn)])].sort();

  return (
    <>
      <Baslik k="genel_bakis.takvim" alt="GİB vergi takvimi, resmî tatiller ve bayramlar, SGK ve dönem sonu tarihleri, kişisel hatırlatmalar. Her kayıt kaynağını gösterir.">
        {gunceller ? (
          <FeatureGate k="genel_bakis.takvim.sync">
            <TakvimGuncelle csrf={oturum.csrf} yil={Number(tarih.slice(0, 4))} ilk={sonIs[0] ? isGorunumu(sonIs[0]) : null} />
          </FeatureGate>
        ) : null}
      </Baslik>
      {yaklasan.length ? (
        <section className="kart yaklasan" aria-labelledby="yaklasan-baslik">
          <h2 id="yaklasan-baslik">Yaklaşan hatırlatmalar</h2>
          <ul className="yaklasan-liste">
            {yaklasan.map((h) => (
              <li key={h.id}>
                <span>
                  <strong>{h.title}</strong> · {tr(h.remindOn)}
                  {h.remindTime ? ` ${h.remindTime}` : ''} · {HKAT.get(h.category)}
                  {h.firmTitle ? ` · ${h.firmTitle}` : ''}
                </span>
                {hatirlatir ? <HatirlatmaIslemleri csrf={oturum.csrf} id={h.id} done={h.done} baslik={h.title} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {hatirlatir ? (
        <FeatureGate k="genel_bakis.takvim.remind">
          <HatirlatmaFormu
            key={kaynakKaydi?.key ?? 'yeni'}
            csrf={oturum.csrf}
            kategoriler={REMINDER_CATEGORIES.map((x) => ({ id: x.id, ad: x.title }))}
            firmalar={firmalar.map((f) => ({ id: f.id, ad: f.title }))}
            ilk={kaynakKaydi ? { title: kaynakKaydi.title, remindOn: kaynakKaydi.date, sourceEntry: kaynakKaydi.key } : { remindOn: tarih }}
            acik={!!kaynakKaydi}
          />
        </FeatureGate>
      ) : null}
      <nav className="takvim-ust" aria-label="Takvim gezinmesi">
        <div className="takvim-gezin">
          <Link className="dugme ikincil" href={sorgu({ tarih: kaydir(gorunum, tarih, -1) })} aria-label="Önceki dönem">
            ‹ Önceki
          </Link>
          <Link className="dugme ikincil" href={sorgu({ tarih: bu })}>
            Bugün
          </Link>
          <Link className="dugme ikincil" href={sorgu({ tarih: kaydir(gorunum, tarih, 1) })} aria-label="Sonraki dönem">
            Sonraki ›
          </Link>
        </div>
        <h2 className="takvim-baslik">{baslik}</h2>
        <ul className="takvim-gorunumler" aria-label="Görünüm">
          {GORUNUMLER.map((g) => (
            <li key={g.id}>
              <Link className="dugme ikincil kucuk" href={sorgu({ gorunum: g.id })} aria-current={g.id === gorunum ? 'page' : undefined}>
                {g.baslik}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form className="filtre takvim-filtre" method="get">
        <input type="hidden" name="gorunum" value={gorunum} />
        <input type="hidden" name="tarih" value={tarih} />
        <fieldset>
          <legend>Kaynak</legend>
          {CALENDAR_SOURCES.map((x) => (
            <label key={x.id} className="secim">
              <input type="checkbox" name="kaynak" value={x.id} defaultChecked={secilenKaynak.includes(x.id)} /> {x.title}
            </label>
          ))}
          <label className="secim">
            <input type="checkbox" name="kaynak" value={KISISEL} defaultChecked={secilenKaynak.includes(KISISEL)} /> Kişisel hatırlatmalar
          </label>
        </fieldset>
        <fieldset>
          <legend>Kategori</legend>
          {CALENDAR_CATEGORIES.map((x) => (
            <label key={x.id} className="secim">
              <input type="checkbox" name="kategori" value={x.id} defaultChecked={kategoriler.includes(x.id)} /> <span className={`renk kat-${x.id}`} aria-hidden="true" />
              {x.title}
            </label>
          ))}
        </fieldset>
        <label>
          Ara
          <input name="q" type="search" maxLength={100} defaultValue={a.q ?? ''} placeholder="Beyanname, KDV, bayram…" />
        </label>
        <button type="submit" className="dugme ikincil">
          Süz
        </button>
      </form>
      <p className="alt">
        <span aria-hidden="true">≈</span> işaretli tarih kesinleşmemiştir (dinî bayram tahmini ya da mevzuat kuralından hesaplanan son gün); resmî kaynaktan kontrol edin. GİB tarihleri
        genel yükümlülüktür, mükellefe özel hesap yapılmaz.
      </p>
      {hepsi.length === 0 ? (
        <p className="uyari" role="status">
          Bu dönemin takvimi henüz hazır değil. Takvim arka planda birkaç dakika içinde dolar.
        </p>
      ) : null}

      {gorunum === 'ay' ? (
        <div className="takvim-ay-kap">
          <table className="takvim-ay">
            <caption className="gorunmez">{ayAdi(tarih)} takvimi</caption>
            <thead>
              <tr>
                {GUNLER.map((g) => (
                  <th key={g} scope="col">
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((h) => (
                <tr key={h}>
                  {ayIzgarasi(tarih)
                    .slice(h * 7, h * 7 + 7)
                    .map((c) => {
                      const g = gunun(c.tarih);
                      const gh = gununH(c.tarih);
                      const toplam = g.length + gh.length;
                      const kisi = gh.slice(0, AYIN_ILK_UC);
                      const resmi = g.slice(0, Math.max(0, AYIN_ILK_UC - kisi.length));
                      return (
                        <td key={c.tarih} className={`${c.buAy ? '' : 'diger-ay'} ${haftaSonu(c.tarih) ? 'hafta-sonu' : ''} ${tatil(c.tarih) ? 'tatil-gunu' : ''}`}>
                          <Link className="gun-no" href={sorgu({ gorunum: 'gun', tarih: c.tarih })} aria-current={c.tarih === bu ? 'date' : undefined}>
                            <span aria-hidden="true">{Number(c.tarih.slice(8))}</span>
                            <span className="gorunmez">
                              {uzunTarih(c.tarih)}, {toplam} kayıt
                            </span>
                          </Link>
                          {toplam ? (
                            <span className="gun-sayi" aria-hidden="true">
                              {toplam}
                            </span>
                          ) : null}
                          <ul className="gun-kayitlari">
                            {kisi.map((x) => (
                              <li key={x.id}>
                                <HatirlatmaEtiketi h={x} />
                              </li>
                            ))}
                            {resmi.map((e) => (
                              <li key={e.key}>
                                <Kayit e={e} kisa />
                              </li>
                            ))}
                            {toplam > AYIN_ILK_UC ? <li className="daha">+{toplam - AYIN_ILK_UC} daha</li> : null}
                          </ul>
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {gorunum === 'hafta' ? (
        <ol className="takvim-hafta">
          {haftaGunleri(tarih).map((t) => (
            <li key={t} className={`kart ${haftaSonu(t) ? 'hafta-sonu' : ''} ${tatil(t) ? 'tatil-gunu' : ''}`}>
              <h3>
                <Link href={sorgu({ gorunum: 'gun', tarih: t })} aria-current={t === bu ? 'date' : undefined}>
                  {uzunTarih(t)}
                </Link>
              </h3>
              {gunun(t).length || gununH(t).length ? (
                <ul className="gun-kayitlari">
                  {gununH(t).map((x) => (
                    <li key={x.id}>
                      <HatirlatmaEtiketi h={x} />
                    </li>
                  ))}
                  {gunun(t).map((e) => (
                    <li key={e.key}>
                      <Kayit e={e} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="alt">Kayıt yok.</p>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {gorunum === 'gun' || gorunum === 'liste' ? (
        <div className="takvim-liste">
          {listeGunleri.map((t) => (
            <section key={t} className="kart" aria-labelledby={`gun-${t}`}>
              <h3 id={`gun-${t}`}>{uzunTarih(t)}</h3>
              {gunun(t).length === 0 && gununH(t).length === 0 ? <p className="alt">Bu gün için kayıt yok.</p> : null}
              <ul className="takvim-ayrinti">
                {gununH(t).map((h) => (
                  <li key={h.id} className="kat-kisisel">
                    <p className="ayrinti-baslik">
                      <strong>{h.title}</strong> <span className="etiket">Kişisel · {HKAT.get(h.category)}</span>
                      {h.done ? <span className="etiket iyi">Tamamlandı</span> : null}
                    </p>
                    <p className="alt">
                      {h.remindTime ? `Saat ${h.remindTime} · ` : ''}
                      {h.remindDays ? `${h.remindDays} gün önce hatırlatılır` : 'Aynı gün hatırlatılır'}
                      {h.firmTitle ? ` · ${h.firmTitle}` : ''}
                    </p>
                    {h.note ? <p className="not-metni">{h.note}</p> : null}
                    {hatirlatir ? <HatirlatmaIslemleri csrf={oturum.csrf} id={h.id} done={h.done} baslik={h.title} /> : null}
                  </li>
                ))}
                {gunun(t).map((e) => (
                  <li key={e.key} className={`kat-${e.category}`}>
                    <p className="ayrinti-baslik">
                      <strong>{e.title}</strong> <span className="etiket">{KAT.get(e.category)}</span>{' '}
                      <span className={`etiket ${e.certainty === 'kesin' ? 'iyi' : 'bekliyor'}`}>{e.certainty === 'kesin' ? 'Kesin' : 'Kesinleşmedi'}</span>
                      {e.halfDay ? <span className="etiket">Yarım gün</span> : null}
                    </p>
                    <p>{e.description}</p>
                    <p className="alt">
                      Kaynak: {KAYNAK.get(e.source)}
                      {e.period ? ` · Dönem: ${e.period}` : ''}
                      {e.reference ? ` · ${e.reference}` : ''}
                      {e.checkedAt ? ` · kontrol ${tr(e.checkedAt)}` : ''}
                      {e.corrected ? ` · ofis düzeltmesi (kaynak tarihi ${tr(e.originalDate)})` : ''}
                      {e.sourceUrl ? (
                        <>
                          {' · '}
                          <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                            Kaynağı aç<span className="gorunmez"> (yeni sekmede açılır)</span>
                          </a>
                        </>
                      ) : null}
                    </p>
                    <div className="eylemler">
                      {hatirlatir ? (
                        <Link className="dugme ikincil kucuk" href={sorgu({ hatirlat: e.key })} aria-label={`${e.title} için hatırlatma ekle`}>
                          Hatırlatma ekle
                        </Link>
                      ) : null}
                      {duzeltir ? (
                        <FeatureGate k="genel_bakis.takvim.edit">
                          <TakvimDuzelt csrf={oturum.csrf} id={e.key} tarih={e.date} duzeltilmis={e.corrected} baslik={e.title} />
                        </FeatureGate>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {gorunum === 'liste' && listeGunleri.length === 0 && hepsi.length > 0 ? <p className="alt">Süzgece uyan kayıt yok.</p> : null}
        </div>
      ) : null}

      {gorunum === 'yil' ? (
        <ul className="takvim-yil">
          {Array.from({ length: 12 }, (_, i) => `${tarih.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`).map((ay) => {
            const ayinKayitlari = kayitlar.filter((e) => e.date.startsWith(ay.slice(0, 7)));
            const ayinH = hatirlatmalar.filter((h) => h.remindOn.startsWith(ay.slice(0, 7))).length;
            return (
              <li key={ay} className="kart">
                <h3>
                  <Link href={sorgu({ gorunum: 'ay', tarih: ay })}>{ayAdi(ay)}</Link>
                </h3>
                <p>{ayinKayitlari.length + ayinH} kayıt</p>
                <ul className="yil-ozet">
                  {CALENDAR_CATEGORIES.filter((x) => ayinKayitlari.some((e) => e.category === x.id)).map((x) => (
                    <li key={x.id}>
                      <span className={`renk kat-${x.id}`} aria-hidden="true" /> {x.title}: {ayinKayitlari.filter((e) => e.category === x.id).length}
                    </li>
                  ))}
                  {ayinH ? (
                    <li>
                      <span className="renk kat-kisisel" aria-hidden="true" /> Kişisel: {ayinH}
                    </li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="alt">
        Görünen aralık: {tr(from)} – {tr(to)} · {kayitlar.length + hatirlatmalar.length} kayıt
      </p>
    </>
  );
}
