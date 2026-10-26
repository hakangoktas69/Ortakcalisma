import { childrenOf, features, parentOf, type FeatureDef } from '@eworks/feature-registry';
import { isAllowed, type Session } from '@eworks/identity-access';
import durumlar from '@eworks/feature-registry/feature-status.json' with { type: 'json' };

// Özellik durumu (06 §8): derlemede imaja gömülen feature-status.json'dan okunur; elle işaretlenmez.

export type Durum = { status: 'red' | 'green'; green: number; total: number; tests: number };

const tablo = durumlar as Record<string, Durum>;

/**
 * TDD özellik durumu (kırmızı/yeşil rozet, kırmızı çerçeve) ekranda görünsün mü (D39). Yalnız geliştirme ve hata ayıklama
 * kipinde: yığın betiği OZELLIK_DURUMU_GOSTER=true yazar. Verilmezse demo/üretim görünümü (portal normal renklerinde).
 * Sunucuda, her istekte okunur; tarayıcıya ortam değişkeni gitmez (D5).
 */
export const durumGosterilir = (env: Record<string, string | undefined> = process.env): boolean => env['OZELLIK_DURUMU_GOSTER'] === 'true';

export const durum = (anahtar: string): Durum => tablo[anahtar] ?? { status: 'red', green: 0, total: 1, tests: 0 };
export const ozellik = (anahtar: string): FeatureDef | undefined => features[anahtar];
export const altlar = (anahtar: string) => childrenOf(features, anahtar);
export const moduller = () => Object.keys(features).filter((k) => parentOf(k) === null);

/** Anahtar → adres: `firmalar.liste` → `/firmalar/liste`; ana sayfa `/`. */
export const yol = (anahtar: string) => (anahtar === 'genel_bakis.panel' || anahtar === 'genel_bakis' ? '/' : `/${anahtar.replaceAll('.', '/')}`);

/** Bir modülün menüde açılacak hedefi: ilk sayfası, sayfası yoksa kendisi. */
export const menuHedefi = (modul: string) => altlar(modul).find((k) => ozellik(k)?.kind === 'page') ?? modul;

/** Gezinmede görünürlük: düğümün kendisi ya da altındaki herhangi bir düğüm izinliyse (05 §3.4). Yetki kararı değildir. */
export const gorunur = (s: Session, k: string): boolean => isAllowed(s.grants, k) || altlar(k).some((a) => gorunur(s, a));

/** Modülün görünür sayfaları (kategori kartı ve modül sayfası aynı süzgeci kullanır). */
export const gorunurSayfalar = (modul: string, gorunurMu: (k: string) => boolean) => altlar(modul).filter((p) => ozellik(p)?.kind === 'page' && gorunurMu(p));
