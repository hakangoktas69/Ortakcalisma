import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SgkController } from './sgk.controller.js';
import { ViziteSyncService } from './vizite-sync.service.js';
import { SGK_QUEUE, SgkSyncProcessor } from './sgk-sync.processor.js';
import { VIZITE_CLIENT } from './vizite/vizite.types.js';
import { MockViziteClient } from './vizite/mock-vizite.client.js';
import { SoapViziteClient } from './vizite/soap-vizite.client.js';
import { TescilSyncService } from './tescil-sync.service.js';
import { EBildirgeService } from './ebildirge/ebildirge.service.js';
import { TESCIL_CLIENT } from './tescil/tescil.types.js';
import { MockTescilClient } from './tescil/mock-tescil.client.js';
import { LiveTescilClient } from './tescil/live-tescil.client.js';

@Module({
  imports: [BullModule.registerQueue({ name: SGK_QUEUE })],
  controllers: [SgkController],
  providers: [
    ViziteSyncService,
    TescilSyncService,
    EBildirgeService,
    SgkSyncProcessor,
    {
      provide: VIZITE_CLIENT,
      useFactory: () => (process.env.SGK_MODE === 'live' ? new SoapViziteClient() : new MockViziteClient()),
    },
    {
      provide: TESCIL_CLIENT,
      useFactory: () => (process.env.SGK_MODE === 'live' ? new LiveTescilClient() : new MockTescilClient()),
    },
  ],
  exports: [EBildirgeService],
})
export class SgkModule {}
