import type { AccountStatus } from '@eworks/credentials';

// Toplu e-Tebligat çekimi (tebligat.liste.sync; D45, D46). e-Beyanname'den farkı: beyanname müşavirin tek GİB
// oturumuyla okunur, e-Tebligat ise her firmanın KENDİ GİB hesabıyla — kurumun listesi oturuma bağlıdır ve
// istekte mükellef kimliği taşınmaz. Bu yüzden toplu çekim firma başına ayrı iştir.
//
// Burada yalnız saf karar vardır (hangi firma için iş açılır, hangisi neden atlanır); işi açmak ve yetki denetimi
// uç noktanın işidir. Veritabanı, iş başlarken onayı ve hesabı yeniden denetler (fail-closed).

export type TebligatAdayi = { id: string; title: string; taxId: string; archivedAt: string | null };

/** Atlama nedenleri kullanıcıya sayı olarak gösterilir; hiçbiri hata değildir, eksik kurulumdur. */
export type AtlamaNedeni = 'arsiv' | 'onay_yok' | 'hesap_yok' | 'hesap_kullanilamaz';

export type TopluKarar = {
  acilacak: { id: string; taxId: string; hesap: AccountStatus }[];
  atlanan: { title: string; neden: AtlamaNedeni }[];
};

/**
 * Kapsamdaki firmalardan hangileri için e-Tebligat işi açılabilir?
 *
 * - Arşivlenmiş firma kapsam dışıdır.
 * - Mükellef onayı yoksa kurum hesabı kullanılamaz (D46).
 * - Firmanın kendi GİB hesabı yoksa okunacak hesap yoktur (müşavir hesabı ya da SGK/UETS sayılmaz).
 * - Şifresi hatalı / kilitli / devre dışı hesap **denenmez**: kurum hesabının kilitlenmesini önleyen koruma
 *   (05 §4) toplu çekimde de geçerlidir, yoksa tek tuşla bütün hesaplar kilitlenebilirdi.
 */
export function topluTebligatKarari(firmalar: readonly TebligatAdayi[], onayliFirmalar: ReadonlySet<string>, hesaplar: readonly AccountStatus[]): TopluKarar {
  const gib = new Map(hesaplar.filter((h) => h.ownerKind === 'firm' && h.institution === 'GIB').map((h) => [h.ownerId, h]));
  const karar: TopluKarar = { acilacak: [], atlanan: [] };
  for (const f of firmalar) {
    const atla = (neden: AtlamaNedeni) => karar.atlanan.push({ title: f.title, neden });
    if (f.archivedAt) {
      atla('arsiv');
      continue;
    }
    if (!onayliFirmalar.has(f.id)) {
      atla('onay_yok');
      continue;
    }
    const hesap = gib.get(f.id);
    if (!hesap) {
      atla('hesap_yok');
      continue;
    }
    if (hesap.status !== 'active') {
      atla('hesap_kullanilamaz');
      continue;
    }
    karar.acilacak.push({ id: f.id, taxId: f.taxId, hesap });
  }
  return karar;
}

/** Kullanıcıya gösterilecek özet: "8 mükellef için iş açıldı · 3 atlandı (2 onay yok, 1 GİB hesabı yok)". */
export const topluOzet = (acilan: number, atlanan: readonly { neden: AtlamaNedeni }[]): string => {
  const ad: Record<AtlamaNedeni, string> = {
    arsiv: 'arşivli',
    onay_yok: 'mükellef onayı yok',
    hesap_yok: 'GİB hesabı yok',
    hesap_kullanilamaz: 'GİB şifresi hatalı ya da hesap kilitli',
  };
  const sayim = new Map<AtlamaNedeni, number>();
  for (const a of atlanan) sayim.set(a.neden, (sayim.get(a.neden) ?? 0) + 1);
  const ayrinti = [...sayim].map(([n, s]) => `${s} ${ad[n]}`).join(', ');
  return `${acilan} mükellef için güncelleme başlatıldı${atlanan.length ? ` · ${atlanan.length} atlandı (${ayrinti})` : ''}.`;
};
