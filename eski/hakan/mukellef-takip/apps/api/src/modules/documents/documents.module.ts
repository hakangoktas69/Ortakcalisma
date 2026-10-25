import { Module } from '@nestjs/common';
import { PetitionsController } from './interface/http/petitions.controller.js';
import { PetitionsService } from './application/petitions.service.js';

@Module({
  controllers: [PetitionsController],
  providers: [PetitionsService],
})
export class DocumentsModule {}
