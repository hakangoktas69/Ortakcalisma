import { Module } from '@nestjs/common';
import { TaxFilingModule } from '../tax-filing/index.js';
import { TebligatModule } from '../tebligat/index.js';
import { PayrollModule } from '../payroll/index.js';
import { NotificationsModule } from '../notifications/index.js';
import { SocialSecurityModule } from '../social-security/index.js';
import { InboxController } from './interface/http/inbox.controller.js';
import { DashboardController } from './interface/http/dashboard.controller.js';
import { ReportsController } from './interface/http/reports.controller.js';
import { InboxService } from './application/inbox.service.js';

// Okuma modeli: iş kutusu, özet ekranı ve CSV raporlar diğer context'lerin sorgularını birleştirir.
@Module({
  imports: [TaxFilingModule, TebligatModule, PayrollModule, NotificationsModule, SocialSecurityModule],
  controllers: [InboxController, DashboardController, ReportsController],
  providers: [InboxService],
})
export class WorkspaceModule {}
