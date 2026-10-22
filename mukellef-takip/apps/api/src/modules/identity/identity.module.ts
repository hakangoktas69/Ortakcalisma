import { Global, Module } from '@nestjs/common';
import { AuthController } from './interface/http/auth.controller.js';
import { TokensController } from './interface/http/tokens.controller.js';
import { UsersController } from './interface/http/users.controller.js';
import { AuthService } from './application/auth.service.js';
import { SessionService } from './application/session.service.js';
import { ApiTokenService } from './application/api-token.service.js';
import { PasswordResetService } from './application/password-reset.service.js';
import { ResetCodeSender } from './infrastructure/reset-code.sender.js';
import { CaptchaStore } from './infrastructure/captcha.store.js';

// Global: AuthGuard/ImportGuard her context'in controller'ında kullanılır ve bu servislere ihtiyaç duyar.
@Global()
@Module({
  controllers: [AuthController, TokensController, UsersController],
  providers: [AuthService, SessionService, ApiTokenService, PasswordResetService, ResetCodeSender, CaptchaStore],
  exports: [ApiTokenService, SessionService],
})
export class IdentityModule {}
