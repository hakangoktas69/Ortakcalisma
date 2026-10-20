// tebligat context'inin yayınladığı olaylar (abone: notifications).

export const TEBLIGAT_IMPORTED = 'tebligat.imported';

/** Bir mükellef için yeni e-tebligat(lar) aktarıldı. `first`: tebliğ sayılma tarihi en yakın olan. */
export interface TebligatImported {
  [key: string]: string | number | null | { subject: string | null; sender: string | null; deemedServedAt: string };
  companyId: string;
  companyTitle: string;
  count: number;
  first: { subject: string | null; sender: string | null; deemedServedAt: string };
}
