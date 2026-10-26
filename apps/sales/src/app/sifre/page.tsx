import { satisSayfaIzni } from '@/bff/oturum.ts';
import { SifreFormu } from '@/features/sales/SifreFormu.tsx';
import { Kabuk } from '@/shared/ui/Kabuk.tsx';

// Parola değiştirme (satis.oturum). Geçici parolayla giren satışçı başka sayfaya geçmeden önce buraya yönlenir.
export default async function Sifre() {
  const { oturum } = await satisSayfaIzni('satis.oturum');
  return (
    <Kabuk ad={oturum.fullName} csrf={oturum.csrf} etkin="sifre">
      <div>
        <h1>Parola değiştir</h1>
        {oturum.mustChangePassword ? (
          <p className="uyari">
            Geçici parolayla giriş yaptınız. Devam etmek için kendi parolanızı belirleyin.
          </p>
        ) : (
          <p className="alt">Parola değişince diğer cihazlardaki oturumlarınız kapanır.</p>
        )}
      </div>
      <SifreFormu csrf={oturum.csrf} />
    </Kabuk>
  );
}
