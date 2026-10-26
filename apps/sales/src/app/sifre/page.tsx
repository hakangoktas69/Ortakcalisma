import { satisSayfaIzni } from '@/bff/oturum.ts';
import { IkiAdimKapatFormu } from '@/features/sales/IkiAdimKapatFormu.tsx';
import { SifreFormu } from '@/features/sales/SifreFormu.tsx';
import { Kabuk } from '@/shared/ui/Kabuk.tsx';

// Parola ve güvenlik (satis.oturum): parola değiştirme ve iki adımlı doğrulamanın açılıp kapatılması (D41: isteğe bağlı).
// Geçici parolayla giren satışçı başka sayfaya geçmeden önce buraya yönlenir.
export default async function Sifre({ searchParams }: { searchParams: Promise<{ '2fa'?: string }> }) {
  const { oturum } = await satisSayfaIzni('satis.oturum');
  const kapatildi = (await searchParams)['2fa'] === 'kapatildi';
  return (
    <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="sifre">
      <div>
        <h1>Parola ve güvenlik</h1>
        {oturum.mustChangePassword ? (
          <p className="uyari">Geçici parolayla giriş yaptınız. Devam etmek için kendi parolanızı belirleyin.</p>
        ) : (
          <p className="alt">Parola ya da iki adımlı doğrulama değişince diğer cihazlardaki oturumlarınız kapanır.</p>
        )}
      </div>
      <section aria-labelledby="parola-baslik">
        <h2 id="parola-baslik">Parola</h2>
        <SifreFormu csrf={oturum.csrf} />
      </section>
      <section className="kart form" aria-labelledby="iki-adim-baslik">
        <h2 id="iki-adim-baslik">İki adımlı doğrulama: {oturum.twoFactor ? 'açık' : 'kapalı'}</h2>
        {kapatildi && !oturum.twoFactor ? (
          <p className="basari" role="status">
            İki adımlı doğrulama kapatıldı.
          </p>
        ) : null}
        {oturum.twoFactor ? (
          <>
            <p className="alt">Girişte parolanın ardından telefonunuzdaki kod istenir. Kapatırsanız her girişte resimli güvenlik kodu yazarsınız.</p>
            <IkiAdimKapatFormu csrf={oturum.csrf} />
          </>
        ) : (
          <>
            <p className="alt">Kapalıyken her girişte resimli güvenlik kodu istenir. Açarsanız parolanızın yanında telefonunuzdaki kod da gerekir; hesabınız parola ele geçse bile korunur.</p>
            <div className="eylemler">
              <a className="dugme birincil" href="/guvenlik/2fa">
                İki adımlı doğrulamayı aç
              </a>
            </div>
          </>
        )}
      </section>
    </Kabuk>
  );
}
