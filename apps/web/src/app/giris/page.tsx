import { redirect } from 'next/navigation';
import { oturum } from '@/bff/oturum.ts';

const HATALAR: Record<string, string> = {
  giris: 'E-posta ya da parola hatalı.',
  eksik: 'E-posta ve parola gerekli.',
  kaynak: 'İstek doğrulanamadı; sayfayı yenileyip tekrar deneyin.',
};

export default async function Giris({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (await oturum()) redirect('/');
  const { hata } = await searchParams;
  return (
    <main className="giris">
      <form method="post" action="/api/oturum/giris" className="kart giris-kart">
        <h1>Eworks</h1>
        <p className="alt">Ofis hesabınızla giriş yapın. Kurum (GİB/SGK) şifrenizi burada kullanmayın.</p>
        {hata && HATALAR[hata] ? (
          <p className="uyari" role="alert">
            {HATALAR[hata]}
          </p>
        ) : null}
        <label>
          E-posta
          <input name="eposta" type="email" autoComplete="username" required />
        </label>
        <label>
          Parola
          <input name="parola" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit" className="dugme birincil">
          Giriş yap
        </button>
      </form>
    </main>
  );
}
