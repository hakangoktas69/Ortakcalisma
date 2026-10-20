import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SgkController } from './interface/http/sgk.controller.js';
import { ViziteSyncService } from './application/vizite-sync.service.js';
import { SGK_QUEUE, SgkSyncService } from './application/sgk-sync.service.js';
import { SgkSyncProcessor } from './infrastructure/sgk-sync.processor.js';
import { VIZITE_CLIENT } from './application/ports/vizite.types.js';
import { MockViziteClient } from './infrastructure/vizite/mock-vizite.client.js';
import { SoapViziteClient } from './infrastructure/vizite/soap-vizite.client.js';
import { TescilSyncService } from './application/tescil-sync.service.js';
import { EBildirgeService } from './application/ebildirge.service.js';
import { TESCIL_CLIENT } from './application/ports/tescil.types.js';
import { MockTescilClient } from './infrastructure/tescil/mock-tescil.client.js';
import { LiveTescilClient } from './infrastructure/tescil/live-tescil.client.js';

@Module({
  imports: [BullModule.registerQueue({ name: SGK_QUEUE })],
  controllers: [SgkController],
  providers: [
    ViziteSyncService,
    TescilSyncService,
    EBildirgeService,
    SgkSyncService,
    {
      provide: VIZITE_CLIENT,
      useFactory: () => (process.env.SGK_MODE === 'live' ? new SoapViziteClient() : new MockViziteClient()),
    },
    {
      provide: TESCIL_CLIENT,
      useFactory: () => (process.env.SGK_MODE === 'live' ? new LiveTescilClient() : new MockTescilClient()),
    },
  ],
  exports: [EBildirgeService, SgkSyncService],
})
export class SocialSecurityModule {}

/** Yalnız worker süreci: SGK kuyruğunu işler ve gece senkronunu zamanlar. */
@Module({
  imports: [SocialSecurityModule, BullModule.registerQueue({ name: SGK_QUEUE })],
  providers: [SgkSyncProcessor],
})
export class SocialSecurityWorkerModule {}
