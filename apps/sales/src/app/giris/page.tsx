import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginCaptcha, loginStart } from '@eworks/sales';
import { konteyner } from '@/bff/konteyner.ts';
import { baslangicCerezi, satisOturumu } from '@/bff/oturum.ts';
import { Marka } from '@/shared/ui/Marka.tsx';

// Satış girişi (D41): 1) e-posta; 2) parola — iki adımlı doğrulaması kapalı hesapta (ve bilinmeyen e-postada) resimdeki
// güvenlik kodu da istenir, kod çözülmeden parola denenmez. Her açılışta yeni kod; kod görüntüsü data: adresli SVG (CSP img-src).
// Form BFF'e gider; tarayıcıda belirteç yok (D5). Hata nedeni ayrıntılandırılmaz.

const HATALAR: Record<string, string> = {
  giris: 'E-posta ya da parola hatalı. Art arda 5 hatalı denemede hesap 15 dakika kilitlenir.',
  kod: 'Güvenlik kodu hatalı; resimdeki yeni kodu yazın.',
  eksik: 'E-posta ve parola gerekli.',
  sure: 'Giriş adımının süresi doldu; yeniden giriş yapın.',
  kaynak: 'İstek doğrulanamadı; sayfayı yenileyip tekrar deneyin.',
  servis: 'Giriş şu an yapılamıyor; biraz sonra tekrar deneyin.',
};

export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string; yeni?: string }> }) {
  if (await satisOturumu()) redirect('/');
  const { hata, yeni } = await searchParams;
  const startId = yeni ? undefined : (await cookies()).get(baslangicCerezi())?.value;
  const k = konteyner().giris;
  const baslangic = startId ? await loginStart(startId, k) : null;
  const kodResmi = startId && baslangic?.captcha ? await loginCaptcha(startId, k) : null;
  const uyari = hata && HATALAR[hata] ? (
    <p className="hata" role="alert">
      {HATALAR[hata]}
    </p>
  ) : null;
  return (
    <main className="giris">
      {baslangic ? (
        <form method="post" action="/api/oturum/giris" className="giris-kart">
          <Marka />
          <h1>Satış ekibi girişi</h1>
          <p className="alt">
            <span className="gorunmez">E-posta: </span>
            <strong>{baslangic.email}</strong> · <a href="/giris?yeni=1">Başka e-posta</a>
          </p>
          {uyari}
          <label>
            Parola
            <input name="parola" type="password" autoComplete="current-password" required maxLength={128} />
          </label>
          {kodResmi ? (
            <div className="alan">
              <label htmlFor="kod">Güvenlik kodu</label>
              <img className="guvenlik-kodu" src={`data:image/svg+xml;base64,${Buffer.from(kodResmi).toString('base64')}`} alt="Güvenlik kodu resmi" width={160} height={56} />
              <input id="kod" name="kod" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={10} aria-describedby="kod-ipucu" />
              <span className="ipucu" id="kod-ipucu">
                Resimdeki 5 karakteri yazın (büyük/küçük harf fark etmez). Okuyamıyorsanız sayfayı yenileyin. İki adımlı doğrulamayı açarsanız bu kod istenmez.
              </span>
            </div>
          ) : null}
          <button type="submit" className="dugme birincil">
            Giriş yap
          </button>
        </form>
      ) : (
        <form method="post" action="/api/oturum/baslat" className="giris-kart">
          <Marka />
          <h1>Satış ekibi girişi</h1>
          <p className="alt">Bu portal yalnız satış ekibi içindir. Müşavirler kendi portallarından giriş yapar.</p>
          {uyari}
          <label>
            E-posta
            <input name="eposta" type="email" autoComplete="username" required maxLength={254} />
          </label>
          <button type="submit" className="dugme birincil">
            Devam et
          </button>
        </form>
      )}
    </main>
  );
}
