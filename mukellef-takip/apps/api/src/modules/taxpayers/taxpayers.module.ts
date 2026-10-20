import { Module } from '@nestjs/common';
import { CompaniesController } from './interface/http/companies.controller.js';

@Module({
  controllers: [CompaniesController],
})
export class TaxpayersModule {}
