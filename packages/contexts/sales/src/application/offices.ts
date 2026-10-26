import { err, ok, type Clock, type Result } from '@eworks/kernel';
import { ACCOUNT_STATUSES, accountStatus, findPlan, formatPhone, trialEnd, validateNewOffice, type AccountStatus, type NewOfficeField, type NewOfficeInput } from '../domain/sales-account.ts';
import { openOffice, type ProvisionDeps } from './provisioning.ts';
import type { SalesAuditEntry, SalesPrincipal } from './sales-auth.ts';

// Satışın ofis işleri: liste ve "yeni ofis" (ofis + yönetici müşavir + deneme lisansı). Mükellef iş verisi bu bağlama gelmez;
// listede yalnız kontrol düzlemindeki dizin ve satış hesabı vardır. Ofisi etkileyen işlem iki denetim kaydına yazılır:
// satış kaydı (burada) ve ofisin kendi kaydı (shard'daki hesap açma fonksiyonu, `by` ile).

export type SalesAccountRecord = {
  readonly orgId: string;
  readonly contactName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly plan: string;
  readonly trialEndsAt: Date | null;
  readonly expiresAt: Date | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
};

/** Listede: satış hesabı + dizindeki ofis adı ve dondurma durumu. Hesabı olmayan ofis (komutla açılmış) de listelenir. */
export type OfficeListRow = Omit<SalesAccountRecord, 'contactName' | 'contactEmail' | 'contactPhone' | 'plan' | 'createdBy' | 'createdAt'> & {
  readonly officeName: string;
  readonly frozen: boolean;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly plan: string | null;
  readonly createdAt: Date | null;
};

export interface SalesAccountRepository {
  /** Satış hesabı ve satış denetim kaydı tek veritabanı işleminde yazılır. */
  insert(a: SalesAccountRecord, audit: SalesAuditEntry): Promise<void>;
  list(): Promise<OfficeListRow[]>;
}

/**
 * Kısa süreli kilit (Redis SET NX + jeton): aynı ad için eşzamanlı iki "ofis aç" isteği (çift tıklama) yarışmasın.
 * Veritabanında ad indeksi yok (yerel verilerde aynı adlı ofisler var). Yalnız kilidi alan, jetonuyla bırakır.
 */
export interface LockPort {
  acquire(key: string, ttlSeconds: number): Promise<string | null>;
  release(key: string, token: string): Promise<void>;
}

export type OfficeSaleDeps = ProvisionDeps & {
  accounts: SalesAccountRepository;
  locks: LockPort;
  crypto: { tempPassword(): string };
  clock: Clock;
};

export type OfficeView = {
  orgId: string;
  officeName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  planName: string;
  status: AccountStatus;
  trialEndsAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date | null;
};

const kucuk = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Ofis listesi: durum lisanstan hesaplanır; ada, yetkiliye, e-postaya göre arama ve durum süzgeci; ada göre sıralı. */
export async function listOffices(filter: { q?: string; status?: string }, d: Pick<OfficeSaleDeps, 'accounts' | 'clock'>): Promise<OfficeView[]> {
  const now = d.clock.now();
  const q = kucuk((filter.q ?? '').trim());
  const status = (ACCOUNT_STATUSES as readonly string[]).includes(filter.status ?? '') ? filter.status : undefined;
  return (await d.accounts.list())
    .map((a) => ({
      orgId: a.orgId,
      officeName: a.officeName,
      contactName: a.contactName ?? '',
      contactEmail: a.contactEmail ?? '',
      contactPhone: formatPhone(a.contactPhone),
      planName: (a.plan && findPlan(a.plan)?.name) || '',
      status: accountStatus(a, now),
      trialEndsAt: a.trialEndsAt,
      expiresAt: a.expiresAt,
      createdAt: a.createdAt,
    }))
    .filter((o) => (!status || o.status === status) && (!q || [o.officeName, o.contactName, o.contactEmail].some((x) => kucuk(x).includes(q))))
    .sort((a, b) => a.officeName.localeCompare(b.officeName, 'tr'));
}

export type OpenOfficeError = 'gecersiz' | 'ofis_var' | 'eposta_kullanimda' | 'islem_suruyor';

/** Yeni ofis: ofis + yönetici müşavir (geçici parola, bir kez döner) + deneme lisansı. */
export async function openOfficeForSale(
  by: SalesPrincipal,
  input: NewOfficeInput,
  d: OfficeSaleDeps,
): Promise<Result<{ orgId: string; email: string; tempPassword: string }, OpenOfficeError> & { errors?: { field: NewOfficeField; message: string }[] }> {
  const v = validateNewOffice(input);
  if (!v.ok) return { ...err('gecersiz'), errors: v.errors };
  const f = v.value;
  const kilit = `ofis-ac:${kucuk(f.officeName)}`;
  const jeton = await d.locks.acquire(kilit, 120);
  if (!jeton) return err('islem_suruyor');
  try {
    if (await d.directory.organizationByName(f.officeName)) return err('ofis_var');
    const tempPassword = d.crypto.tempPassword();
    const r = await openOffice({ officeName: f.officeName, admin: { email: f.email, password: tempPassword, name: f.contactName }, by: by.userId }, d);
    if (!r.ok) return err(r.error === 'kullanici_var_parola_farkli' ? 'eposta_kullanimda' : 'gecersiz');
    const now = d.clock.now();
    const bitis = trialEnd(now, f.trialDays);
    await d.accounts.insert(
      {
        orgId: r.value.orgId, contactName: f.contactName, contactEmail: f.email, contactPhone: f.phone, plan: f.plan,
        trialEndsAt: bitis, expiresAt: bitis, createdBy: by.userId, createdAt: now,
      },
      { salesUserId: by.userId, action: 'satis.ofis.acildi', subject: r.value.orgId, details: { paket: f.plan, deneme_gun: f.trialDays } },
    );
    return ok({ orgId: r.value.orgId, email: f.email, tempPassword });
  } finally {
    await d.locks.release(kilit, jeton);
  }
}
