import { Module } from '@nestjs/common';
import { DeclarationsModule } from '../declarations/declarations.module.js';
import { EDefterModule } from '../edefter/edefter.module.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [DeclarationsModule, EDefterModule],
  controllers: [ReportsController],
})
export class ReportsModule {}
