import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma.service.js';
import { VaultService } from '../vault/vault.service.js';
import { AuditService } from '../audit.service.js';
import type { AuthUser } from './auth.guard.js';
import { generateRecoveryCodes, generateSecret, hashRecoveryCode, otpauthUri, verifyTotp } from './totp.js';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const BCRYPT_COST = 12;
// Kayıtlı olmayan e-postalarda da aynı maliyette karşılaştırma yapmak için gerçek bir özet
const DUMMY_HASH = bcrypt.hashSync('kullanici-yok-zamanlama-esitleme', BCRYPT_COST);

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

export const hashPassword = (pw: string) => bcrypt.hash(pw, BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
  ) {}

  private accessToken(u: { id: string; tenantId: string; role: 'ADMIN' | 'STAFF'; sessionVersion: number }) {
    const payload: AuthUser = { sub: u.id, tenantId: u.tenantId, role: u.role, sv: u.sessionVersion, purpose: 'access' };
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

  private async completeLogin(u: { id: string; tenantId: string; role: 'ADMIN' | 'STAFF'; sessionVersion: number; mustChangePassword: boolean }) {
    await this.prisma.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.login' });
    return { accessToken: await this.accessToken(u), mustChangePassword: u.mustChangePassword };
  }

  /** 1. adım: e-posta + şifre. 2FA açıksa 5 dakikalık ara token döner. */
  async login(email: string, password: string) {
    const u = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Kullanıcı yoksa da bcrypt çalıştır: yanıt süresinden e-postanın kayıtlı olup olmadığı anlaşılmasın
    if (!u) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    this.assertNotLocked(u);
    if (!(await bcrypt.compare(password, u.passwordHash)) || !u.isActive) {
      await this.registerFailure(u.id, u.failedLogins);
      throw new UnauthorizedException('E-posta veya şifre hatalı');
    }
    if (u.totpEnabledAt) {
      const mfaToken = await this.jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role, sv: u.sessionVersion, purpose: 'mfa' } satisfies AuthUser, {
        expiresIn: '5m',
      });
      return { mfaRequired: true as const, mfaToken };
    }
    return this.completeLogin(u);
  }

  /** 2. adım: doğrulayıcı kodu veya tek kullanımlık kurtarma kodu. */
  async loginSecondFactor(mfaToken: string, code?: string, recoveryCode?: string) {
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
    return this.completeLogin(u);
  }

  async changePassword(user: AuthUser, current: string, next: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    if (!(await bcrypt.compare(current, u.passwordHash))) throw new BadRequestException('Mevcut şifre hatalı');
    checkPasswordPolicy(next);
    if (await bcrypt.compare(next, u.passwordHash)) throw new BadRequestException('Yeni şifre eskisiyle aynı olamaz');
    const updated = await this.prisma.user.update({
      where: { id: u.id },
      data: { passwordHash: await hashPassword(next), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.password.change' });
    // Diğer cihazlardaki oturumlar düşer; bu cihaz için yeni token
    return { accessToken: await this.accessToken(updated) };
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
    return { recoveryCodes, accessToken: await this.accessToken(updated) };
  }

  /** Kapatmak için şifre ve geçerli kod birlikte istenir. */
  async disableTotp(user: AuthUser, password: string, code: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub }, include: { tenant: { select: { require2fa: true } } } });
    if (!u.totpEnabledAt || !u.totpSecretEnc) throw new BadRequestException('İki adımlı doğrulama kapalı');
    if (u.tenant.require2fa) throw new BadRequestException('Büronuzda iki adımlı doğrulama zorunlu; kapatılamaz. Telefonunuzu değiştirdiyseniz yöneticinizden sıfırlamasını isteyin.');
    if (!(await bcrypt.compare(password, u.passwordHash))) throw new BadRequestException('Şifre hatalı');
    if (verifyTotp(this.vault.decrypt(u.totpSecretEnc), code.replace(/\s/g, ''), Date.now(), u.totpLastStep) === null) {
      throw new BadRequestException('Kod hatalı');
    }
    const updated = await this.prisma.user.update({
      where: { id: u.id },
      data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryCodeHashes: [], sessionVersion: { increment: 1 } },
    });
    await this.audit.log({ tenantId: u.tenantId, userId: u.id, action: 'auth.2fa.disable' });
    return { accessToken: await this.accessToken(updated) };
  }
}
