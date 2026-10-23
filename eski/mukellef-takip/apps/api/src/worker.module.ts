import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { coreImports } from './app.module.js';
import { OutboxDispatcher } from './platform/events/outbox.dispatcher.js';
import { PersonalDataBackfill } from './platform/crypto/personal-data.backfill.js';
import { IdentityModule } from './modules/identity/index.js';
import { SocialSecurityWorkerModule } from './modules/social-security/index.js';
import { NotificationsWorkerModule } from './modules/notifications/index.js';

/**
 * Worker süreci (src/worker.ts): BullMQ işleyicileri, zamanlanmış işler (SGK gece senkronu, sabah
 * hatırlatıcıları), outbox dağıtıcısı ve tek seferlik veri dönüşümleri. HTTP dinlemez; yatay ölçeklenebilir.
 */
@Module({
  imports: [...coreImports(), DiscoveryModule, IdentityModule, SocialSecurityWorkerModule, NotificationsWorkerModule],
  providers: [OutboxDispatcher, PersonalDataBackfill],
})
export class WorkerModule {}
