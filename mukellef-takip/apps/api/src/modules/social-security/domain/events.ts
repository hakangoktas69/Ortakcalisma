// social-security context'inin yayınladığı olaylar (abone: notifications).

export const SGK_REPORTS_RECEIVED = 'sgk.reports.received';

/** Senkronda onay bekleyen yeni e-raporlar geldi. `names` ilk üç çalışanın adı: yalnız uygulama içi bildirimde gösterilir. */
export interface SgkReportsReceived {
  [key: string]: string | number | string[];
  workplaceId: string;
  companyTitle: string;
  count: number;
  names: string[];
}
