import { Module } from '@nestjs/common';
import { TaxFilingModule } from '../tax-filing/index.js';
import { TebligatModule } from '../tebligat/index.js';
import { SocialSecurityModule } from '../social-security/index.js';
import { ImportController } from './interface/http/import.controller.js';

// Eklentinin okuduğu kurum sayfalarını ilgili context'lere dağıtan anti-corruption katmanı.
@Module({
  imports: [TaxFilingModule, TebligatModule, SocialSecurityModule],
  controllers: [ImportController],
})
export class DataIntakeModule {}
