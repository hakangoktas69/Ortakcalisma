import { Module } from '@nestjs/common';
import { DeclarationsController } from './interface/http/declarations.controller.js';
import { EDefterController } from './interface/http/edefter.controller.js';
import { DeclarationsService } from './application/declarations.service.js';
import { EDefterService } from './application/edefter.service.js';
import { GIB_SOURCE, LiveGibSource, MockGibSource } from './infrastructure/gib-source.js';

@Module({
  controllers: [DeclarationsController, EDefterController],
  providers: [
    DeclarationsService,
    EDefterService,
    {
      provide: GIB_SOURCE,
      useFactory: () => (process.env.GIB_MODE === 'live' ? new LiveGibSource() : new MockGibSource()),
    },
  ],
  exports: [DeclarationsService, EDefterService],
})
export class TaxFilingModule {}
