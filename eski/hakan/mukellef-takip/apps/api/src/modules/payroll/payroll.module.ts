import { Module } from '@nestjs/common';
import { PayrollController } from './interface/http/payroll.controller.js';
import { PayrollService } from './application/payroll.service.js';

@Module({
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
