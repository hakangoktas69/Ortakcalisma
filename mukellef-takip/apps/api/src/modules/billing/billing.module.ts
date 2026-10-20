import { Module } from '@nestjs/common';
import { BillingController, IyzicoCallbackController } from './interface/http/billing.controller.js';
import { BillingService } from './application/billing.service.js';
import { IyzicoClient } from './infrastructure/iyzico.client.js';

@Module({
  controllers: [BillingController, IyzicoCallbackController],
  providers: [BillingService, IyzicoClient],
})
export class BillingModule {}
