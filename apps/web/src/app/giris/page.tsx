import { redirect } from 'next/navigation';
import { oturum } from '@/bff/oturum.ts';
import logo from '@/shared/ui/eworks-logo.png';
import { KipEtiketi } from '@/shared/ui/KipEtiketi.tsx';
import { Simge } from '@/shared/ui/Simge.tsx';

// Giriş ekranı (Mert'in Eworks tasarımı: lacivert zemin, beyaz kart, sarı düğme). Form BFF'e gider; tarayıcıda belirteç yok (D5).

const HATALAR: Record<string, string> = {
  giris: 'E-posta ya da parola hatalı.',
  eksik: 'E-posta ve parola gerekli.',
  kaynak: 'İstek doğrulanamadı; sayfayı yenileyip tekrar deneyin.',
};

export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (await oturum()) redirect('/');
  const { hata } = await searchParams;
  return (
    <div className="giris">
      <svg className="giris-yorunge" viewBox="0 0 1366 860" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
        <ellipse cx="683" cy="430" rx="660" ry="300" transform="rotate(-18 683 430)" />
        <ellipse cx="683" cy="430" rx="560" ry="240" transform="rotate(-18 683 430)" />
        <circle className="isik sari" cx="54" cy="603" r="5" />
        <circle className="isik mavi" cx="216" cy="739" r="5" />
        <circle className="isik mavi" cx="1149" cy="120" r="4" />
        <circle className="isik sari" cx="1311" cy="256" r="4" />
      </svg>
      <main className="giris-alan">
        <form method="post" action="/api/oturum/giris" className="giris-kart">
          <div className="giris-marka">
            <img src={logo.src} alt="Eworks" width={233} height={70} />
            <KipEtiketi />
            <p className="giris-ust">Dijital iş portalı</p>
          </div>
          <h1>Hoş geldiniz</h1>
          <p className="giris-not">Ofis hesabınızla giriş yapın. Kurum (GİB/SGK) şifrenizi burada kullanmayın.</p>
          {hata && HATALAR[hata] ? (
            <p className="uyari" role="alert">
              {HATALAR[hata]}
            </p>
          ) : null}
          <label className="giris-alani">
            E-posta
            <span className="giris-girdi">
              <Simge ad="user" />
              <input name="eposta" type="email" autoComplete="username" required />
            </span>
          </label>
          <label className="giris-alani">
            Parola
            <span className="giris-girdi">
              <Simge ad="lock" />
              <input name="parola" type="password" autoComplete="current-password" required />
            </span>
          </label>
          <button type="submit" className="giris-dugme">
            Giriş yap
            <Simge ad="arrow" />
          </button>
        </form>
        <p className="giris-etiket">
          <Simge ad="lock" />
          Eworks Kullanıcı Portalı
        </p>
      </main>
      <footer className="giris-alt">© {new Date().getFullYear()} Eworks</footer>
    </div>
  );
}
