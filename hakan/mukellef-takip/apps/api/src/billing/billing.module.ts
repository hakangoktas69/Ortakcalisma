import { Module } from '@nestjs/common';
import { BillingController, IyzicoCallbackController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { IyzicoClient } from './iyzico.client.js';

@Module({
  controllers: [BillingController, IyzicoCallbackController],
  providers: [BillingService, IyzicoClient],
})
export class BillingModule {}
