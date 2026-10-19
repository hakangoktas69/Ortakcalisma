import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { CoreModule } from './core.module.js';
import { SgkModule } from './sgk/sgk.module.js';
import { DeclarationsModule } from './declarations/declarations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { TebligatModule } from './tebligat/tebligat.module.js';
import { ImportController } from './import/import.controller.js';
import { EDefterModule } from './edefter/edefter.module.js';
import { PetitionsModule } from './petitions/petitions.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { BillingModule } from './billing/billing.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { PayrollModule } from './payroll/payroll.module.js';
import { InboxModule } from './inbox/inbox.module.js';
import { AuthController } from './auth/auth.controller.js';
import { TokensController } from './auth/tokens.controller.js';
import { UsersController } from './auth/users.controller.js';
import { AuthService } from './auth/auth.service.js';
import { CompaniesController } from './companies/companies.controller.js';
import { DashboardController } from './dashboard/dashboard.controller.js';

const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '8h' },
      }),
    }),
    BullModule.forRoot({ connection: { host: redis.hostname, port: Number(redis.port || 6379) } }),
    CoreModule,
    SgkModule,
    DeclarationsModule,
    NotificationsModule,
    TebligatModule,
    EDefterModule,
    PetitionsModule,
    ReportsModule,
    BillingModule,
    AssistantModule,
    InvoicesModule,
    PayrollModule,
    InboxModule,
  ],
  providers: [AuthService],
  controllers: [AuthController, TokensController, UsersController, CompaniesController, DashboardController, ImportController],
})
export class AppModule {}
