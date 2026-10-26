import { redirect } from 'next/navigation';
import { satisOturumu } from '@/bff/oturum.ts';
import { Marka } from '@/shared/ui/Marka.tsx';

// Satış girişi, 1. adım: e-posta + parola. Form BFF'e gider; tarayıcıda belirteç yok (D5). Hata nedeni ayrıntılandırılmaz.

const HATALAR: Record<string, string> = {
  giris: 'E-posta ya da parola hatalı. Art arda 5 hatalı denemede hesap 15 dakika kilitlenir.',
  eksik: 'E-posta ve parola gerekli.',
  sure: 'Giriş adımının süresi doldu; yeniden giriş yapın.',
  kaynak: 'İstek doğrulanamadı; sayfayı yenileyip tekrar deneyin.',
  servis: 'Giriş şu an yapılamıyor; biraz sonra tekrar deneyin.',
};

export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (await satisOturumu()) redirect('/');
  const { hata } = await searchParams;
  return (
    <main className="giris">
      <form method="post" action="/api/oturum/giris" className="giris-kart">
        <Marka />
        <h1>Satış ekibi girişi</h1>
        <p className="alt">Bu portal yalnız satış ekibi içindir. Müşavirler kendi portallarından giriş yapar.</p>
        {hata && HATALAR[hata] ? (
          <p className="hata" role="alert">
            {HATALAR[hata]}
          </p>
        ) : null}
        <label>
          E-posta
          <input name="eposta" type="email" autoComplete="username" required maxLength={254} />
        </label>
        <label>
          Parola
          <input name="parola" type="password" autoComplete="current-password" required maxLength={128} />
        </label>
        <button type="submit" className="dugme birincil">
          Devam et
        </button>
      </form>
    </main>
  );
}
