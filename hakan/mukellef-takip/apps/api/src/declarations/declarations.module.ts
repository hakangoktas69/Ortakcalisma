import { Module } from '@nestjs/common';
import { DeclarationsController } from './declarations.controller.js';
import { DeclarationsService } from './declarations.service.js';
import { GIB_SOURCE, LiveGibSource, MockGibSource } from './gib/gib-source.js';

@Module({
  controllers: [DeclarationsController],
  providers: [
    DeclarationsService,
    {
      provide: GIB_SOURCE,
      useFactory: () => (process.env.GIB_MODE === 'live' ? new LiveGibSource() : new MockGibSource()),
    },
  ],
  exports: [DeclarationsService],
})
export class DeclarationsModule {}
