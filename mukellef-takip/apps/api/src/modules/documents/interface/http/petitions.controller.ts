import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from '../../../identity/index.js';
import { PetitionsService } from '../../application/petitions.service.js';

class PrepareDto {
  @IsString() templateId: string;
  @IsString() companyId: string;
}

class SaveDto {
  @IsString() companyId: string;
  @IsOptional() @IsString() templateId?: string;
  @IsString() @MinLength(2) @MaxLength(200) title: string;
  @IsString() @MinLength(10) @MaxLength(20_000) content: string;
}

class TemplateDto {
  @IsString() @MinLength(2) @MaxLength(200) title: string;
  @IsIn(['Vergi dairesi', 'SGK', 'Genel']) category: string;
  @IsString() @MinLength(10) @MaxLength(20_000) body: string;
}

@Controller('petitions')
@UseGuards(AuthGuard)
export class PetitionsController {
  constructor(private readonly petitions: PetitionsService) {}

  @Get('templates')
  templates(@CurrentUser() user: AuthUser) {
    return this.petitions.templates(user.tenantId);
  }

  @Post('templates')
  createTemplate(@CurrentUser() user: AuthUser, @Body() dto: TemplateDto) {
    return this.petitions.createTemplate(user.tenantId, dto);
  }

  @Put('templates/:id')
  async updateTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TemplateDto) {
    await this.petitions.updateTemplate(user.tenantId, id, dto);
    return { ok: true };
  }

  @Delete('templates/:id')
  async deleteTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.petitions.deleteTemplate(user.tenantId, id);
    return { ok: true };
  }

  @Post('prepare')
  prepare(@CurrentUser() user: AuthUser, @Body() dto: PrepareDto) {
    return this.petitions.prepare(user.tenantId, user.sub, dto.templateId, dto.companyId);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string) {
    return this.petitions.list(user.tenantId, companyId);
  }

  @Post()
  save(@CurrentUser() user: AuthUser, @Body() dto: SaveDto) {
    return this.petitions.save(user.tenantId, user.sub, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.petitions.get(user.tenantId, id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.petitions.remove(user.tenantId, id);
    return { ok: true };
  }
}
