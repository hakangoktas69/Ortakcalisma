import { Global, Module } from '@nestjs/common';
import { AuthController } from './interface/http/auth.controller.js';
import { TokensController } from './interface/http/tokens.controller.js';
import { UsersController } from './interface/http/users.controller.js';
import { AuthService } from './application/auth.service.js';
import { SessionService } from './application/session.service.js';
import { ApiTokenService } from './application/api-token.service.js';

// Global: AuthGuard/ImportGuard her context'in controller'ında kullanılır ve bu servislere ihtiyaç duyar.
@Global()
@Module({
  controllers: [AuthController, TokensController, UsersController],
  providers: [AuthService, SessionService, ApiTokenService],
  exports: [ApiTokenService, SessionService],
})
export class IdentityModule {}
