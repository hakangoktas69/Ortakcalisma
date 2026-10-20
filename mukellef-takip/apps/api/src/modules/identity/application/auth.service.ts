import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { VaultService } from '../../../platform/crypto/vault.service.js';
import { AuditService } from '../../../platform/audit/audit.service.js';
import { runAsSystem } from '../../../platform/database/tenant-context.js';
import { dummyHash, hashPassword, needsRehash, verifyPassword } from '../infrastructure/password-hasher.js';
import { SessionService } from './session.service.js';
import type { AuthUser } from '../interface/http/auth.guard.js';
import { generateRecoveryCodes, generateSecret, hashRecoveryCode, otpauthUri, verifyTotp } from '../domain/totp.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** Şifre kuralı: en az 10 karakter, harf ve rakam içersin. */
export function checkPasswordPolicy(pw: string) {
  if (pw.length < 10) throw new BadRequestException('Şifre en az 10 karakter olmalı');
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/\d/.test(pw)) throw new BadRequestException('Şifre harf ve rakam içermeli');
}

/** Yöneticinin verdiği geçici şifre: karışabilen karakterler (0/O, 1/l/I) yok, kurala uygun. */
export function generateTempPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const chars = [letters[randomInt(letters.length)], digits[randomInt(digits.length)]];
  while (chars.length < 12) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export { hashPassword };

/** Giriş isteğinin cihaz bilgisi (oturum listesinde gösterilir). */
export interface LoginMeta {
  userAgent?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  private accessToken(u: { id: string; tenantId: string; role: 'ADMIN' | 'STAFF'; sessionVersion: number }, familyId?: string) {
    const payload: AuthUser = { sub: u.id, tenantId: u.tenantId, role: u.role, sv: u.sessionVersion, purpose: 'access', ...(familyId ? { fid: familyId } : {}) };
    return this.jwt.signAsync(payload);
  }

  private async registerFailure(userId: string, failed: number) {
    const n = failed + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: n >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: n },
    });
  }

  private assertNotLocked(u: { lockedUntil: Date | null }) {
    if (u.lockedUntil && u.lockedUntil > new Date()) {
      const min = Math.ceil((u.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new UnauthorizedException(`Çok fazla hatalı deneme. ${min} dakika sonra tekrar deneyin.`);
    }
  }

  private async completeLogin(u: { id: string; tenantId: string; role: 'ADMIN' | 'STAFF'; sessionVersion: number; mustChangePassword: boolean }, meta: LoginMeta) {
    await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    const session = await this.sessions.start(u, meta);
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.login', detail: { session: session.familyId } });
    return { accessToken: await this.accessToken(u, session.familyId), refreshToken: session.refreshToken, mustChangePassword: u.mustChangePassword };
  }

  /** Yenileme anahtarıyla yeni erişim + yenileme anahtarı (eskisi tek kullanımlık). */
  async refresh(refreshToken: string, meta: LoginMeta = {}) {
    const r = await this.sessions.rotate(refreshToken, meta.userAgent);
    const u = await runAsSystem(() => this.prisma.user.findUniqueOrThrow({ where: { id: r.user.id }, select: { id: true, tenantId: true, role: true, sessionVersion: true } }));
    return { accessToken: await this.accessToken(u, r.familyId), refreshToken: r.refreshToken };
  }

  /** sessionVersion arttıktan sonra (şifre/2FA değişikliği) bu cihaz için yeni oturum. */
  private async freshSession(u: { id: string; tenantId: string; role: 'ADMIN' | 'STAFF'; sessionVersion: number }) {
    const session = await this.sessions.start(u, {});
    return { accessToken: await this.accessToken(u, session.familyId), refreshToken: session.refreshToken };
  }

  /** Başarılı girişte eski (bcrypt) ya da eski parametreli özeti argon2id'ye çevirir. */
  private async rehashIfNeeded(u: { id: string; passwordHash: string }, password: string) {
    if (needsRehash(u.passwordHash)) await this.prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(password) } });
  }

  /** 1. adım: e-posta + şifre. 2FA açıksa 5 dakikalık ara token döner. */
  login(email: string, password: string, meta: LoginMeta = {}) {
    // Büro henüz bilinmiyor: sorgular sistem bağlamında (RLS dışı), yalnız bu kullanıcıya dokunur
    return runAsSystem(() => this.loginInner(email, password, meta));
  }

  private async loginInner(email: string, password: string, meta: LoginMeta) {
    const u = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Kullanıcı yoksa da özet doğrula: yanıt süresinden e-postanın kayıtlı olup olmadığı anlaşılmasın
    if (!u) {
      await verifyPassword(await dummyHash(), password);
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    this.assertNotLocked(u);
    if (!(await verifyPassword(u.passwordHash, password)) || !u.isActive) {
      await this.registerFailure(u.id, u.failedLogins);
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    await this.rehashIfNeeded(u, password);
    if (u.totpEnabledAt) {
      const mfaToken = await this.jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role, sv: u.sessionVersion, purpose: 'mfa' } satisfies AuthUser, {
        expiresIn: '5m',
      });
      return { mfaRequired: true as const, mfaToken };
    }
    return this.completeLogin(u, meta);
  }

  /** 2. adım: doğrulayıcı kodu veya tek kullanımlık kurtarma kodu. */
  loginSecondFactor(mfaToken: string, code?: string, recoveryCode?: string, meta: LoginMeta = {}) {
    return runAsSystem(() => this.secondFactorInner(mfaToken, code, recoveryCode, meta));
  }

  private async secondFactorInner(mfaToken: string, code: string | undefined, recoveryCode: string | undefined, meta: LoginMeta) {
    let p: AuthUser;
    try {
      p = await this.jwt.verifyAsync<AuthUser>(mfaToken);
    } catch {
      throw new UnauthorizedException('Doğrulama süresi doldu, tekrar giriş yapın');
    }
    if (p.purpose !== 'mfa') throw new UnauthorizedException();
    const u = await this.prisma.user.findUnique({ where: { id: p.sub } });
    if (!u || !u.isActive || !u.totpEnabledAt || !u.totpSecretEnc || u.sessionVersion !== p.sv) throw new UnauthorizedException();
    this.assertNotLocked(u);

    if (code) {
      const step = verifyTotp(this.vault.decrypt(u.totpSecretEnc), code.replace(/\s/g, ''), Date.now(), u.totpLastStep);
      if (step === null) {
        await this.registerFailure(u.id, u.failedLogins);
        throw new UnauthorizedException('Kod hatalı');
      }
      await this.prisma.user.update({ where: { id: u.id }, data: { totpLastStep: step } });
    } else if (recoveryCode) {
      const h = hashRecoveryCode(recoveryCode);
      if (!u.recoveryCodeHashes.includes(h)) {
        await this.registerFailure(u.id, u.failedLogins);
        throw new UnauthorizedException('Kurtarma kodu hatalı');
      }
      await this.prisma.user.update({ where: { id: u.id }, data: { recoveryCodeHashes: u.recoveryCodeHashes.filter((x) => x !== h) } });
      await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.recovery-code.used', detail: { remaining: u.recoveryCodeHashes.length - 1 } });
    } else {
      throw new BadRequestException('Kod gerekli');
    }
    return this.completeLogin(u, meta);
  }

  async changePassword(user: AuthUser, current: string, next: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    if (!(await verifyPassword(u.passwordHash, current))) throw new BadRequestException('Mevcut şifre hatalı');
    checkPasswordPolicy(next);
    if (await verifyPassword(u.passwordHash, next)) throw new BadRequestException('Yeni şifre eskisiyle aynı olamaz');
    const updated = await this.prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.password.change' });
    // Diğer cihazlardaki oturumlar düşer (sessionVersion); bu cihaz için yeni oturum
    return this.freshSession(updated);
  }

  /** 2FA kurulumu: gizli anahtarı üretip (henüz etkin değil) şifreli saklar, QR kodu döner. */
  async setupTotp(user: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub }, select: { email: true, totpEnabledAt: true } });
    if (u.totpEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    const secret = generateSecret();
    await this.prisma.user.update({ where: { id: user.sub }, data: { totpSecretEnc: this.vault.encrypt(secret), totpLastStep: null } });
    const uri = otpauthUri(secret, u.email);
    return { secret, otpauthUri: uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
  }

  /** Kurulumu ilk kodla doğrular, etkinleştirir; kurtarma kodlarını BİR KEZ döner. */
  async enableTotp(user: AuthUser, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    if (u.totpEnabledAt) throw new BadRequestException('İki adımlı doğrulama zaten açık');
    if (!u.totpSecretEnc) throw new BadRequestException('Önce kurulumu başlatın');
    const step = verifyTotp(this.vault.decrypt(u.totpSecretEnc), code.replace(/\s/g, ''));
    if (step === null) throw new BadRequestException('Kod hatalı. Telefonunuzun saatinin doğru olduğundan emin olun.');
    const recoveryCodes = generateRecoveryCodes();
    const updated = await this.prisma.user.update({
      where: { id: u.id },
      data: { totpEnabledAt: new Date(), totpLastStep: step, recoveryCodeHashes: recoveryCodes.map(hashRecoveryCode), sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.2fa.enable' });
    return { recoveryCodes, ...(await this.freshSession(updated)) };
  }

  /** Kapatmak için şifre ve geçerli kod birlikte istenir. */
  async disableTotp(user: AuthUser, password: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub }, include: { tenant: { select: { require2fa: true } } } });
    if (!u.totpEnabledAt || !u.totpSecretEnc) throw new BadRequestException('İki adımlı doğrulama kapalı');
    if (u.tenant.require2fa) throw new BadRequestException('Büronuzda iki adımlı doğrulama zorunlu; kapatılamaz. Telefonunuzu değiştirdiyseniz yöneticinizden sıfırlamasını isteyin.');
    if (!(await verifyPassword(u.passwordHash, password))) throw new BadRequestException('Şifre hatalı');
    if (verifyTotp(this.vault.decrypt(u.totpSecretEnc), code.replace(/\s/g, ''), Date.now(), u.totpLastStep) === null) {
      throw new BadRequestException('Kod hatalı');
    }
    const updated = await this.prisma.user.update({
      where: { id: u.id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.2fa.disable' });
    return this.freshSession(updated);
  }
}
