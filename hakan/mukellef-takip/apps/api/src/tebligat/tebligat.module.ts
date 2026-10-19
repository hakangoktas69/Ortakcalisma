import { Module } from '@nestjs/common';
import { TebligatController } from './tebligat.controller.js';
import { TebligatService } from './tebligat.service.js';

@Module({
  controllers: [TebligatController],
  providers: [TebligatService],
  exports: [TebligatService],
})
export class TebligatModule {}
