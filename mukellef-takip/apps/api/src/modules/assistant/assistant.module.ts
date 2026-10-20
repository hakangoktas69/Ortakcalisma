import { Module } from '@nestjs/common';
import { AssistantController } from './interface/http/assistant.controller.js';
import { ASSISTANT_PROVIDER, AssistantService } from './application/assistant.service.js';
import { createAssistantProvider } from './infrastructure/assistant.providers.js';

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, { provide: ASSISTANT_PROVIDER, useFactory: createAssistantProvider }],
})
export class AssistantModule {}
