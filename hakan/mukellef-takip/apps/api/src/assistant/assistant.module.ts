import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller.js';
import { ASSISTANT_PROVIDER, AssistantService } from './assistant.service.js';
import { createAssistantProvider } from './assistant.providers.js';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, { provide: ASSISTANT_PROVIDER, useFactory: createAssistantProvider }],
})
export class AssistantModule {}
