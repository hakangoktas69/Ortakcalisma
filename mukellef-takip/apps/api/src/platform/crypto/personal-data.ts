import { Injectable } from '@nestjs/common';
import { VaultService } from './vault.service.js';

/** Şifreli kişi alanlarının veritabanındaki biçimi (SgkReport, EmploymentEvent, PayrollLine). */
export interface SealedPerson {
  tckn: null;
  fullName: null;
  tcknEnc: string;
  tcknHash: string;
  fullNameEnc: string;
}

export interface StoredPerson {
  tckn?: string | null;
  fullName?: string | null;
  tcknEnc?: string | null;
  fullNameEnc?: string | null;
}

/**
 * Çalışan kimlik alanları (T.C. kimlik no, ad soyad) — KVKK kişisel veri; e-rapor kayıtlarında sağlık
 * verisiyle birlikte özel nitelikli hâle gelir. Veritabanında şifreli durur; eşitlik araması ve tekillik
 * için HMAC özeti (tcknHash) kullanılır. Düz kolonlar yalnız geçiş dönemindeki eski kayıtlar içindir.
 */
@Injectable()
export class PersonalDataService {
  constructor(private readonly vault: VaultService) {}

  tcknHash(tckn: string) {
    return this.vault.blindIndex('tckn', tckn);
  }

  seal(p: { tckn: string; fullName: string }): SealedPerson {
    return { tckn: null, fullName: null, tcknEnc: this.vault.encrypt(p.tckn), tcknHash: this.tcknHash(p.tckn), fullNameEnc: this.vault.encrypt(p.fullName) };
  }

  /** Şifreli (yeni) ya da düz (eski) kaydı okur. */
  open(row: StoredPerson): { tckn: string; fullName: string } {
    return {
      tckn: row.tcknEnc ? this.vault.decrypt(row.tcknEnc) : (row.tckn ?? ''),
      fullName: row.fullNameEnc ? this.vault.decrypt(row.fullNameEnc) : (row.fullName ?? ''),
    };
  }
}

/** Prisma select'lerinde kişi alanları için ortak parça. */
export const PERSON_FIELDS = { tckn: true, fullName: true, tcknEnc: true, fullNameEnc: true } as const;
