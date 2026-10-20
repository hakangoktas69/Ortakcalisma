import { Module } from '@nestjs/common';
import { InvoicesController } from './interface/http/invoices.controller.js';
import { InvoicesService } from './application/invoices.service.js';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicingModule {}
