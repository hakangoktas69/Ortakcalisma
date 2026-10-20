import { Module } from '@nestjs/common';
import { TebligatController } from './interface/http/tebligat.controller.js';
import { TebligatService } from './application/tebligat.service.js';

@Module({
  controllers: [TebligatController],
  providers: [TebligatService],
  exports: [TebligatService],
})
export class TebligatModule {}
