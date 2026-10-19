import { Module } from '@nestjs/common';
import { EDefterController } from './edefter.controller.js';
import { EDefterService } from './edefter.service.js';

@Module({
  controllers: [EDefterController],
  providers: [EDefterService],
  exports: [EDefterService],
})
export class EDefterModule {}
