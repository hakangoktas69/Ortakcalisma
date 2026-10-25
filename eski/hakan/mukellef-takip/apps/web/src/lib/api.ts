const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'mt_token';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  /** code: sunucunun makine okunur hata kodu (ör. CAPTCHA_REQUIRED) */
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
    setToken(null);
    // React dışındaki yardımcı fonksiyon: oturum düşünce tüm durumu sıfırlamak için tam sayfa yönlendirme.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/login';
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // Yöneticinin verdiği geçici şifre değiştirilmeden başka sayfa açılamaz
    if (res.status === 403 && body.code === 'PASSWORD_CHANGE_REQUIRED' && typeof window !== 'undefined') {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/sifre-degistir';
    }
    // Büroda 2FA zorunlu ve kullanıcı henüz kurmadıysa kurulum ekranına
    if (res.status === 403 && body.code === 'TWO_FACTOR_REQUIRED' && typeof window !== 'undefined' && window.location.pathname !== '/iki-adim') {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/iki-adim';
    }
    const msg = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new ApiError(res.status, msg ?? 'Bir hata oluştu', body.code);
  }
  return res.json();
}

/** Oturum anahtarıyla dosya indirir (CSV raporlar gibi). Dosya adı sunucunun Content-Disposition başlığından alınır. */
export async function downloadFile(path: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'İndirme başarısız');
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'rapor.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/**
 * Server-Sent Events akışı olarak dönen POST isteği (asistan yanıtı). Her olay geldikçe onEvent çağrılır.
 * Akış başlamadan dönen hatalar (kota, yetki) ApiError olarak fırlatılır.
 */
export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
  signal?: AbortSignal,
) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const b = await res.json().catch(() => ({}));
    const msg = Array.isArray(b.message) ? b.message.join(', ') : b.message;
    throw new ApiError(res.status, msg ?? 'Bir hata oluştu');
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length) onEvent(event, JSON.parse(data.join('\n')));
    }
  }
}

/** Dosyaları çok parçalı form olarak gönderir (api() JSON gönderdiği için ayrı). */
export async function apiUpload<T>(path: string, field: string, files: File[], fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  for (const f of files) fd.append(field, f);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? 'Yükleme başarısız'));
  return body;
}

export type InvoiceDirection = 'OUTGOING' | 'INCOMING';

export interface InvoiceRow {
  id: string;
  direction: InvoiceDirection;
  uuid: string;
  number: string;
  issueDate: string;
  profile: string;
  invoiceType: string;
  counterpartyTaxNumber: string | null;
  counterpartyName: string | null;
  currency: string;
  exchangeRate: number | null;
  taxExclusiveAmount: number;
  vatAmount: number;
  withholdingAmount: number;
  payableAmount: number;
  source: 'UBL_UPLOAD' | 'DEMO';
  company: { id: string; title: string };
}

export interface InvoiceImportResult {
  dryRun: boolean;
  files: number;
  recognized: number;
  create: number;
  duplicate: number;
  foreignWithoutRate: number;
  byCompany: { companyId: string; company: string; outgoing: number; incoming: number }[];
  unmatched: { taxNumber: string; name: string | null; count: number }[];
  unmatchedInvoices: number;
  errors: { name: string; error: string }[];
  errorCount: number;
  skipped: { name: string; reason: string }[];
  skippedCount: number;
}

export interface KdvBucket {
  count: number;
  base: number;
  vat: number;
  withholding: number;
  byRate: { rate: number; base: number; vat: number }[];
  returns: number;
}

export interface InvoiceKdv {
  company: { id: string; title: string; taxNumber: string };
  period: string;
  sales: KdvBucket;
  purchases: KdvBucket;
  missingRate: number;
  calculatedVat: number;
  salesWithholding: number;
  deductibleVat: number;
  kdv2: number;
  difference: number;
}

export interface InvoiceOverviewRow {
  company: { id: string; title: string; taxNumber: string };
  salesCount: number;
  salesBase: number;
  calculatedVat: number;
  salesWithholding: number;
  purchasesCount: number;
  purchasesBase: number;
  deductibleVat: number;
  kdv2: number;
  difference: number;
  missingRate: number;
}

export type ReconcileStatus = 'OK' | 'MISMATCH' | 'NO_EBILDIRGE';

export interface PayrollReconciliation {
  status: ReconcileStatus;
  ebildirge: { insuredCount: number; totalDays: number; premiumBase: number; documents: number } | null;
  diffs: string[];
}

export interface PayrollTotals {
  employeeCount: number;
  totalDays: number;
  gross: number;
  sgkBase: number;
  employeeSgk: number;
  employeeUnemployment: number;
  employerSgk: number | null;
  employerUnemployment: number | null;
  incomeTax: number;
  stampTax: number;
  net: number;
  warningCount: number;
}

export interface PayrollRunSummary extends PayrollTotals {
  id: string;
  period: string;
  source: 'EXCEL_UPLOAD' | 'DEMO';
  fileName: string | null;
  createdAt: string;
  company: { id: string; title: string; taxNumber: string };
  workplace: { id: string; registryNo: string; name: string | null } | null;
  reconciliation: PayrollReconciliation;
}

export interface PayrollLine {
  id: string;
  tckn: string;
  fullName: string;
  days: number;
  gross: number;
  sgkBase: number;
  employeeSgk: number;
  employeeUnemployment: number;
  incomeTax: number;
  stampTax: number;
  net: number;
  warnings: string[];
}

export interface PayrollImportResult {
  dryRun: boolean;
  runId: string | null;
  company: { id: string; title: string };
  workplace: { id: string; registryNo: string; name: string | null } | null;
  period: string;
  replaces: { employeeCount: number; source: string } | null;
  headerRow: number;
  totals: PayrollTotals;
  reconciliation: PayrollReconciliation;
  errors: { row: number; message: string }[];
  errorCount: number;
  warnings: { row: number; fullName: string; warnings: string[] }[];
}

export type InboxKind = 'declaration' | 'tebligat' | 'report' | 'berat' | 'payroll' | 'license';
export type InboxSeverity = 'late' | 'soon' | 'normal';

export interface InboxItem {
  key: string;
  kind: InboxKind;
  severity: InboxSeverity;
  title: string;
  subtitle: string;
  company: { id: string; title: string; taxNumber: string } | null;
  dueDate: string | null;
  date: string;
  detail: Record<string, unknown>;
  snoozedUntil: string | null;
}

export interface InboxResponse {
  generatedAt: string;
  counts: { all: number; late: number; soon: number; snoozed: number; byKind: Record<InboxKind, number> };
  items: InboxItem[];
}

export interface AssistantStatus {
  enabled: boolean;
  mode: 'anthropic' | 'mock' | 'off';
  model: string | null;
  webSearch: boolean;
  dailyLimit: number;
  usedToday: number;
}

export interface AssistantConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface AssistantSource {
  url: string;
  title: string;
}

export interface AssistantChatMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  redactions: Record<string, number> | null;
  sources: AssistantSource[] | null;
  createdAt: string;
}

export type CompanyType = 'SIRKET' | 'SAHIS' | 'BASIT_USUL';

export const companyTypeLabel: Record<CompanyType, string> = {
  SIRKET: 'Şirket',
  SAHIS: 'Şahıs',
  BASIT_USUL: 'Basit Usul',
};

export interface Company {
  id: string;
  title: string;
  taxNumber: string;
  taxOffice: string | null;
  type: CompanyType;
  isActive: boolean;
  phone: string | null;
  email: string | null;
}

export interface Me {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'STAFF';
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  /** Büro yöneticisi 2FA'yı zorunlu yaptıysa */
  twoFactorRequired: boolean;
  recoveryCodesLeft: number;
  tenant: { name: string };
}

export type SyncStatus = 'NEVER' | 'RUNNING' | 'OK' | 'ERROR';

export interface SgkWorkplace {
  id: string;
  registryNo: string;
  name: string | null;
  isBranch: boolean;
  viziteUsername: string | null;
  viziteWorkplaceCode: string | null;
  hasCredentials: boolean;
  hasTescilCredentials: boolean;
  tescilUsername: string | null;
  tescilLastSyncAt: string | null;
  tescilLastSyncStatus: SyncStatus;
  tescilLastSyncError: string | null;
  credentialsUpdatedAt: string | null;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  pendingReports: number;
  company: { id: string; title: string };
}

export interface SgkReport {
  id: string;
  tckn: string;
  fullName: string;
  vaka: number;
  vakaAdi: string | null;
  startDate: string | null;
  endDate: string | null;
  workControlDate: string | null;
  facilityName: string | null;
  status: 'PENDING' | 'APPROVED';
  approvedAt: string | null;
  workplace: { id: string; registryNo: string; company: { title: string } };
}

export interface EmploymentEvent {
  id: string;
  type: 'ENTRY' | 'EXIT';
  tckn: string;
  fullName: string;
  eventDate: string;
  occupationCode: string | null;
  exitReasonCode: string | null;
  exitReason: string | null;
  referenceNo: string | null;
  workplace: { id: string; registryNo: string; company: { title: string } };
}

export interface EBildirgeDocument {
  id: string;
  period: string;
  documentType: string;
  lawNo: string;
  kind: string;
  insuredCount: number | null;
  totalDays: number | null;
  premiumBase: number | null;
  accrualAmount: number | null;
  approvedAt: string | null;
  source: 'EXTENSION' | 'DEMO';
  workplace: { id: string; registryNo: string; name: string | null; company: { title: string } };
}

export type DeclarationType = 'KDV1' | 'MUHSGK' | 'DAMGA' | 'GECICI_VERGI' | 'YILLIK_GELIR' | 'KURUMLAR';
export type ControlStatus = 'FILED' | 'FILED_LATE' | 'PENDING' | 'LATE';
export type StatusCounts = Record<ControlStatus, number>;

export interface ControlCell {
  type: DeclarationType;
  period: string;
  dueDate: string;
  status: ControlStatus;
  declaration: {
    id: string;
    filedAt: string;
    accrualAmount: number | null;
    referenceNo: string | null;
    source: 'MANUAL' | 'GIB' | 'EXTENSION';
  } | null;
}

export interface DeclarationControl {
  mode: 'mock' | 'live';
  year: number;
  month: number;
  periodLabel: string;
  types: { type: DeclarationType; label: string; short: string; period: string; periodLabel: string; dueDate: string; counts: StatusCounts }[];
  rows: { company: { id: string; title: string; taxNumber: string; type: CompanyType }; cells: ControlCell[] }[];
}

export type NotificationCategory = 'TEBLIGAT' | 'SGK_RAPOR' | 'BEYANNAME_SON_GUN' | 'BEYANNAME_GECIKTI' | 'SISTEM';

export const notificationCategoryLabel: Record<NotificationCategory, string> = {
  TEBLIGAT: 'e-Tebligat',
  SGK_RAPOR: 'SGK e-Rapor',
  BEYANNAME_SON_GUN: 'Beyanname son günü yaklaşıyor',
  BEYANNAME_GECIKTI: 'Beyanname süresi geçti',
  SISTEM: 'Sistem',
};

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationList {
  unread: number;
  items: AppNotification[];
}

export interface ETebligat {
  id: string;
  documentNo: string;
  sender: string | null;
  subject: string | null;
  deliveredAt: string;
  deemedServedAt: string;
  readAtGib: string | null;
  reviewedAt: string | null;
  source: 'EXTENSION' | 'DEMO';
  company: { id: string; title: string; taxNumber: string };
}

export interface NotificationSettings {
  phone: string | null;
  whatsappEnabled: boolean;
  whatsappOptInAt: string | null;
  notifyCategories: NotificationCategory[];
  channel: { mode: 'off' | 'mock' | 'live'; configured: boolean };
}

export type BeratStatus = 'FILED' | 'FILED_LATE' | 'PENDING' | 'LATE' | 'NO_DATE';

export interface EDefterControl {
  year: number;
  month: number;
  monthLabel: string;
  counts: Record<BeratStatus, number>;
  skipped: number;
  enabledCompanies: number;
  rows: {
    company: { id: string; title: string; taxNumber: string; type: CompanyType; preference: 'MONTHLY' | 'QUARTERLY' };
    period: string;
    periodLabel: string;
    dueDate: string | null;
    dueDateSource: 'rule' | 'override' | 'none';
    uploadedAt: string | null;
    note: string | null;
    status: BeratStatus;
  }[];
}

export interface PetitionTemplate {
  id: string;
  title: string;
  category: string;
  body: string;
  builtin: boolean;
}

export interface PreparedPetition {
  templateId: string;
  title: string;
  body: string;
  fields: { key: string; label: string; auto: boolean; value: string; multiline: boolean }[];
}

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('tr-TR') : '—';
}

export interface DashboardSummary {
  companies: { total: number; sirket: number; sahis: number; basitUsul: number; aktif: number; pasif: number };
  eBeyanname: {
    month: string;
    periodLabel: string;
    companiesFiled: number;
    typesFiled: number;
    newLast7Days: number;
    filed: number;
    pending: number;
    late: number;
    types: { type: DeclarationType; short: string; dueDate: string; counts: StatusCounts }[];
  };
  sgk: { companies: number; workplaces: number; branches: number; reportsPending: number; reportsApproved: number; entriesThisYear: number; exitsThisYear: number;
    ebildirge: { documents: number; currentEmployees: number; workplacesWithData: number } };
  license: { daysLeft: number; quotaUsed: number; quota: number } | null;
  week: { start: string; end: string; events: { id: string; title: string; dueDate: string }[] };
  eTebligat: { today: number; week: number; month: number; year: number; open: number };
  notifications: AppNotification[];
  unreadCount: number;
}
