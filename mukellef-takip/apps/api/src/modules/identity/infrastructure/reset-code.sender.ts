import { Injectable, Logger } from '@nestjs/common';
import type { ResetIdentifier } from '../domain/password-reset.js';

export type ResetDeliveryMode = 'off' | 'mock';

/**
 * "Şifremi unuttum" kodunu e-posta ya da SMS ile iletir. Henüz gerçek sağlayıcı yok:
 * - off: özellik kapalı (üretimde gerçek sağlayıcı seçilene kadar)
 * - mock: kod gönderilmez; geliştirmede API yanıtında görünür (PasswordResetService)
 * Sağlayıcı (SMTP / SMS firması) seçilince `send` burada gerçeklenir, servis değişmez.
 * Log'a kod, e-posta ya da telefon yazılmaz (yalnız kanal).
 */
@Injectable()
export class ResetCodeSender {
  private readonly logger = new Logger(ResetCodeSender.name);
  readonly mode: ResetDeliveryMode = process.env.PASSWORD_RESET_MODE === 'mock' ? 'mock' : 'off';

  get enabled() {
    return this.mode !== 'off';
  }

  async send(to: ResetIdentifier, _code: string): Promise<void> {
    if (this.mode === 'mock') this.logger.log(`Şifre sıfırlama kodu (deneme modu, gönderilmedi): ${to.kind === 'email' ? 'e-posta' : 'SMS'}`);
  }
}
