import { childrenOf, features, parentOf, type FeatureDef } from '@eworks/feature-registry';
import durumlar from '@eworks/feature-registry/feature-status.json' with { type: 'json' };

// Özellik durumu (06 §8): derlemede imaja gömülen feature-status.json'dan okunur; elle işaretlenmez.

export type Durum = { status: 'red' | 'green'; green: number; total: number; tests: number };

const tablo = durumlar as Record<string, Durum>;

export const durum = (anahtar: string): Durum => tablo[anahtar] ?? { status: 'red', green: 0, total: 1, tests: 0 };
export const ozellik = (anahtar: string): FeatureDef | undefined => features[anahtar];
export const altlar = (anahtar: string) => childrenOf(features, anahtar);
export const moduller = () => Object.keys(features).filter((k) => parentOf(k) === null);

/** Anahtar → adres: `firmalar.liste` → `/firmalar/liste`; ana sayfa `/`. */
export const yol = (anahtar: string) => (anahtar === 'genel_bakis.panel' || anahtar === 'genel_bakis' ? '/' : `/${anahtar.replaceAll('.', '/')}`);

/** Bir modülün menüde açılacak hedefi: ilk sayfası, sayfası yoksa kendisi. */
export const menuHedefi = (modul: string) => altlar(modul).find((k) => ozellik(k)?.kind === 'page') ?? modul;
