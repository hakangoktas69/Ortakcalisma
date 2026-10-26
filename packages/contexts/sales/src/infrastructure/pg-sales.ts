import { withTx, type Client, type Pool } from '@eworks/platform';
import { LOCK_MINUTES, MAX_FAILED } from '../domain/sales-user.ts';
import type { OfficeListRow, SalesAccountRecord, SalesAccountRepository } from '../application/offices.ts';
import type { SalesAuditEntry, SalesAuditPort, SalesUserRecord, SalesUserRepository } from '../application/sales-auth.ts';

// Satışın kontrol düzlemi adaptörleri (`sales` şeması, eworks_sales rolü). Kiracı verisi değildir: satış kullanıcıları ve
// ofislerin satış hesapları tek kontrol düzlemindedir; RLS yerine rol yetkisi sınırdır (control/20261026_0001).

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  is_active: boolean;
  failed_logins: number;
  locked_until: Date | null;
  totp_secret_enc: string | null;
  totp_enabled_at: Date | null;
  totp_last_step: string | null;
  recovery_code_hashes: string[];
  session_version: number;
  must_change_password: boolean;
};

const user = (r: UserRow): SalesUserRecord => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  passwordHash: r.password_hash,
  isActive: r.is_active,
  failedLogins: r.failed_logins,
  lockedUntil: r.locked_until,
  totpSecretEnc: r.totp_secret_enc,
  totpEnabledAt: r.totp_enabled_at,
  // bigint metin gelir; adım sayısı (≈ 6·10^7) Number'a sığar
  totpLastStep: r.totp_last_step === null ? null : Number(r.totp_last_step),
  recoveryCodeHashes: r.recovery_code_hashes,
  sessionVersion: r.session_version,
  mustChangePassword: r.must_change_password,
});

const USER_COLS = `id, email, full_name, password_hash, is_active, failed_logins, locked_until, totp_secret_enc, totp_enabled_at,
  totp_last_step, recovery_code_hashes, session_version, must_change_password`;

// Güncellenebilir alanlar → sütun (beyaz liste; sütun adı hiçbir zaman girdiden gelmez)
const PATCH_COLS: Record<string, string> = {
  passwordHash: 'password_hash',
  failedLogins: 'failed_logins',
  lockedUntil: 'locked_until',
  sessionVersion: 'session_version',
  mustChangePassword: 'must_change_password',
};

const denetim = (c: Client, e: SalesAuditEntry) => c.query('select sales.record($1, $2, $3, $4)', [e.salesUserId, e.action, e.subject, JSON.stringify(e.details ?? {})]);

export class PgSalesUsers implements SalesUserRepository {
  private readonly db: Pool;
  constructor(db: Pool) {
    this.db = db;
  }
  async byEmail(email: string) {
    const { rows } = await this.db.query<UserRow>(`select ${USER_COLS} from sales.users where email = $1`, [email]);
    return rows[0] ? user(rows[0]) : null;
  }
  async byId(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { rows } = await this.db.query<UserRow>(`select ${USER_COLS} from sales.users where id = $1`, [id]);
    return rows[0] ? user(rows[0]) : null;
  }
  insert(u: { id: string; email: string; fullName: string; passwordHash: string; mustChangePassword: boolean }, audit: SalesAuditEntry) {
    return withTx(this.db, async (c) => {
      const r = await c.query(
        'insert into sales.users(id, email, full_name, password_hash, must_change_password) values ($1, $2, $3, $4, $5) on conflict (email) do nothing',
        [u.id, u.email, u.fullName, u.passwordHash, u.mustChangePassword],
      );
      if (r.rowCount !== 1) return 'exists' as const;
      await denetim(c, audit);
      return 'ok' as const;
    });
  }
  async update(id: string, patch: Partial<SalesUserRecord>, audit?: SalesAuditEntry) {
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      const col = PATCH_COLS[k];
      if (!col || v === undefined) continue;
      values.push(v);
      sets.push(`${col} = $${values.length}`);
    }
    if (!sets.length && !audit) return;
    await withTx(this.db, async (c) => {
      if (sets.length) await c.query(`update sales.users set ${sets.join(', ')} where id = $1`, values);
      if (audit) await denetim(c, audit);
    });
  }
  /** Tek UPDATE (satır kilidi): paralel hatalı denemeler sayacı kaybetmez. Eşik ve süre domain kuralından. */
  recordFailure(id: string, now: Date, lockAudit: SalesAuditEntry) {
    return withTx(this.db, async (c) => {
      const { rows } = await c.query<{ locked_until: Date | null; kilitlendi: boolean }>(
        `update sales.users set
           failed_logins = case when failed_logins + 1 >= $2 then 0 else failed_logins + 1 end,
           locked_until = case when failed_logins + 1 >= $2 then $3::timestamptz + make_interval(mins => $4) else locked_until end
         where id = $1
         returning locked_until, (failed_logins = 0) as kilitlendi`,
        [id, MAX_FAILED, now, LOCK_MINUTES],
      );
      const r = rows[0];
      if (r?.kilitlendi) await denetim(c, lockAudit);
      return { lockedUntil: r?.kilitlendi ? r.locked_until : null };
    });
  }
  /** Koşullu: 2FA açıkken anahtar yazılmaz (iki sekme yarışında açık 2FA'nın anahtarı ezilmez). */
  async setPendingTotpSecret(id: string, sealed: string) {
    const r = await this.db.query('update sales.users set totp_secret_enc = $2 where id = $1 and totp_enabled_at is null', [id, sealed]);
    return r.rowCount === 1;
  }
  enableTotp(id: string, p: { enabledAt: Date; step: number; recoveryCodeHashes: string[]; sessionVersion: number }, audit: SalesAuditEntry) {
    return withTx(this.db, async (c) => {
      const r = await c.query(
        `update sales.users set totp_enabled_at = $2, totp_last_step = $3, recovery_code_hashes = $4, session_version = $5
          where id = $1 and totp_enabled_at is null and totp_secret_enc is not null`,
        [id, p.enabledAt, p.step, p.recoveryCodeHashes, p.sessionVersion],
      );
      if (r.rowCount !== 1) return false;
      await denetim(c, audit);
      return true;
    });
  }
  disableTotp(id: string, sessionVersion: number, audit: SalesAuditEntry) {
    return withTx(this.db, async (c) => {
      const r = await c.query(
        `update sales.users set totp_enabled_at = null, totp_secret_enc = null, totp_last_step = null, recovery_code_hashes = '{}', session_version = $2
          where id = $1 and totp_enabled_at is not null`,
        [id, sessionVersion],
      );
      if (r.rowCount !== 1) return false;
      await denetim(c, audit);
      return true;
    });
  }
  async consumeTotpStep(id: string, step: number) {
    const r = await this.db.query('update sales.users set totp_last_step = $2 where id = $1 and (totp_last_step is null or totp_last_step < $2)', [id, step]);
    return r.rowCount === 1;
  }
  consumeRecoveryCode(id: string, hash: string, audit: SalesAuditEntry) {
    return withTx(this.db, async (c) => {
      const r = await c.query(
        'update sales.users set recovery_code_hashes = array_remove(recovery_code_hashes, $2) where id = $1 and $2 = any(recovery_code_hashes)',
        [id, hash],
      );
      if (r.rowCount !== 1) return false;
      await denetim(c, audit);
      return true;
    });
  }
}

type AccountRow = {
  org_id: string;
  name: string;
  status: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  plan: string | null;
  trial_ends_at: Date | null;
  expires_at: Date | null;
  created_at: Date | null;
};

export class PgSalesAccounts implements SalesAccountRepository {
  private readonly db: Pool;
  constructor(db: Pool) {
    this.db = db;
  }
  /** Satış hesabı + satış denetim kaydı tek işlemde: biri yazılamazsa ikisi de yazılmaz. */
  async insert(a: SalesAccountRecord, audit: SalesAuditEntry) {
    await withTx(this.db, async (c) => {
      await c.query(
        `insert into sales.accounts(org_id, contact_name, contact_email, contact_phone, plan, trial_ends_at, expires_at, created_by, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.orgId, a.contactName, a.contactEmail, a.contactPhone, a.plan, a.trialEndsAt, a.expiresAt, a.createdBy, a.createdAt],
      );
      await denetim(c, audit);
    });
  }
  /** Bütün ofisler (dizin) + varsa satış hesabı. Ofis sayısı yüzlerle sınırlı (D2: 500 ofis hedefi); sayfalama ekranda. */
  async list(): Promise<OfficeListRow[]> {
    const { rows } = await this.db.query<AccountRow>(
      `select o.id as org_id, o.name, o.status, a.contact_name, a.contact_email, a.contact_phone, a.plan, a.trial_ends_at, a.expires_at,
              coalesce(a.created_at, o.created_at) as created_at
         from directory.organizations o left join sales.accounts a on a.org_id = o.id
        order by o.name limit 5000`,
    );
    return rows.map((r) => ({
      orgId: r.org_id,
      officeName: r.name,
      frozen: r.status === 'frozen',
      contactName: r.contact_name,
      contactEmail: r.contact_email,
      contactPhone: r.contact_phone,
      plan: r.plan,
      trialEndsAt: r.trial_ends_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  }
}

export class PgSalesAudit implements SalesAuditPort {
  private readonly db: Pool;
  constructor(db: Pool) {
    this.db = db;
  }
  async record(e: { salesUserId: string | null; action: string; subject: string | null; details?: Record<string, string | number> }) {
    await this.db.query('select sales.record($1, $2, $3, $4)', [e.salesUserId, e.action, e.subject, JSON.stringify(e.details ?? {})]);
  }
}
