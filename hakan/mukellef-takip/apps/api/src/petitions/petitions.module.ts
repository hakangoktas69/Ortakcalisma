import { Module } from '@nestjs/common';
import { PetitionsController } from './petitions.controller.js';
import { PetitionsService } from './petitions.service.js';

@Module({
  controllers: [PetitionsController],
  providers: [PetitionsService],
})
export class PetitionsModule {}
