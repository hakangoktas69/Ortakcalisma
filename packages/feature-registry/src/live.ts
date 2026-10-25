import type { LiveVerification } from './define.ts';
import kayitlar from '../canli-dogrulamalar.json' with { type: 'json' };

// Canlı kurum doğrulamaları (D33). Kurumla konuşan bir işlem (`live: true`) sahte kurum testleri geçse bile ancak burada
// kaydı varsa yeşildir. Kayıt canlı koşudan sonra girilir: anahtar, tarih (YYYY-AA-GG), kim, sonuç (sayılarla), sürüm (commit).
// Kişisel veri, VKN/TCKN, kurum yanıtı yazılmaz.
export const liveVerifications: readonly LiveVerification[] = kayitlar as LiveVerification[];
