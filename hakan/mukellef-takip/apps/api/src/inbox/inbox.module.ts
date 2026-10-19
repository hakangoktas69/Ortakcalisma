import { Module } from '@nestjs/common';
import { DeclarationsModule } from '../declarations/declarations.module.js';
import { TebligatModule } from '../tebligat/tebligat.module.js';
import { EDefterModule } from '../edefter/edefter.module.js';
import { PayrollModule } from '../payroll/payroll.module.js';
import { InboxController } from './inbox.controller.js';
import { InboxService } from './inbox.service.js';

@Module({
  imports: [DeclarationsModule, TebligatModule, EDefterModule, PayrollModule],
  controllers: [InboxController],
  providers: [InboxService],
})
export class InboxModule {}
