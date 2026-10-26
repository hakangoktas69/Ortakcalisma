import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adimCerezi } from '@/bff/oturum.ts';
import { Marka } from '@/shared/ui/Marka.tsx';

// Satış girişi, 2. adım: doğrulayıcı uygulamadaki 6 haneli kod ya da tek kullanımlık kurtarma kodu.
// Ara adım çerezi yoksa girişe döner; çerezin geçerliliği uçta denetlenir (adım türü, süre, deneme sayısı).

const HATALAR: Record<string, string> = {
  kod: 'Kod hatalı. Telefonunuzdaki güncel kodu girin; beş hatalı denemede giriş yeniden başlar.',
};

export default async function Dogrula({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  if (!(await cookies()).get(adimCerezi())) redirect('/giris');
  const { hata } = await searchParams;
  return (
    <main className="giris">
      <form method="post" action="/api/oturum/dogrula" className="giris-kart">
        <Marka />
        <h1>İki adımlı doğrulama</h1>
        <p className="alt">Doğrulayıcı uygulamadaki (Google Authenticator, Microsoft Authenticator vb.) 6 haneli kodu girin.</p>
        {hata && HATALAR[hata] ? (
          <p className="hata" role="alert">
            {HATALAR[hata]}
          </p>
        ) : null}
        <label>
          Doğrulama kodu
          <input name="kod" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />
        </label>
        <details>
          <summary>Telefonuma erişemiyorum</summary>
          <label>
            Kurtarma kodu
            <span className="ipucu">2FA kurulumunda verilen 10 koddan biri (ör. abcd-efgh); her kod bir kez kullanılır.</span>
            <input name="kurtarma" autoComplete="off" maxLength={20} />
          </label>
        </details>
        <button type="submit" className="dugme birincil">
          Giriş yap
        </button>
        <a href="/giris">Başka hesapla giriş</a>
      </form>
    </main>
  );
}
