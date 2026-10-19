import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ImportGuard } from '../auth/import.guard.js';
import { AuditService } from '../audit.service.js';
import { DeclarationsService } from '../declarations/declarations.service.js';
import { TebligatService } from '../tebligat/tebligat.service.js';
import { EBildirgeService } from '../sgk/ebildirge/ebildirge.service.js';

class TableDto {
  @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) headers: string[];
  @IsArray() @ArrayMaxSize(5000) @IsArray({ each: true }) rows: string[][];
}

class ImportPageDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => TableDto) tables: TableDto[];
  @IsString() pageUrl: string;
  @IsOptional() @IsBoolean() dryRun?: boolean;
  /** Tebligat sayfasında VKN sütunu yoksa kullanıcının eklentide girdiği VKN/TCKN */
  @IsOptional() @Matches(/^\d{10,11}$/, { message: 'VKN 10, TCKN 11 haneli olmalı' }) taxNumber?: string;
  /** e-Bildirge sayfasında sicil sütunu yoksa kullanıcının girdiği işyeri sicil no */
  @IsOptional() @Matches(/^[\d\s.-]{20,60}$/, { message: 'İşyeri sicil no en az 20 rakam olmalı' }) registryNo?: string;
  /** Eklentinin sayfa metninde bulduğu sicil numarası adayları */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) pageRegistryHints?: string[];
}

/** Sadece resmi GİB ve SGK alan adları (geliştirmede localhost da). */
export function isAllowedImportHost(pageUrl: string): string | null {
  let host = '';
  try {
    host = new URL(pageUrl).hostname;
  } catch {
    return null;
  }
  const official = (domain: string) => host === domain || host.endsWith('.' + domain);
  const ok = official('gib.gov.tr') || official('sgk.gov.tr') || (process.env.NODE_ENV !== 'production' && host === 'localhost');
  return ok ? host : null;
}

/**
 * Eklentinin tek uç noktası: kullanıcının açtığı GİB / SGK sayfasındaki tablolar. Sayfada ne varsa
 * (beyanname listesi, e-tebligat listesi, e-Bildirge belgeleri) tanınır ve ayrı ayrı raporlanır.
 * Varsayılan önizleme (dryRun=true); kayıt için kullanıcı onayıyla dryRun=false gönderilir.
 */
@Controller('import')
export class ImportController {
  constructor(
    private readonly declarations: DeclarationsService,
    private readonly tebligat: TebligatService,
    private readonly ebildirge: EBildirgeService,
    private readonly audit: AuditService,
  ) {}

  @Post('page')
  @UseGuards(ImportGuard)
  async page(@CurrentUser() user: AuthUser & { tokenId?: string }, @Body() dto: ImportPageDto) {
    const host = isAllowedImportHost(dto.pageUrl);
    if (!host) throw new BadRequestException('Sadece GİB (gib.gov.tr) ve SGK (sgk.gov.tr) sayfalarından aktarım yapılabilir');
    const dryRun = dto.dryRun ?? true;

    const declarations = await this.declarations.importTables(user.tenantId, dto.tables, dryRun);
    const tebligat = await this.tebligat.importTables(user.tenantId, dto.tables, dryRun, dto.taxNumber);
    const ebildirge = await this.ebildirge.importTables(user.tenantId, dto.tables, dryRun, {
      registryNo: dto.registryNo,
      pageRegistryHints: dto.pageRegistryHints,
    });

    if (!dryRun) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'gib.import',
        target: host,
        detail: {
          via: user.tokenId ? 'extension-token' : 'session',
          declarations: { create: declarations.create, replaceManual: declarations.replaceManual, complete: declarations.complete },
          tebligat: { create: tebligat.create, update: tebligat.update },
          ebildirge: { create: ebildirge.create, update: ebildirge.update },
        },
      });
    }
    return { dryRun, declarations, tebligat, ebildirge };
  }
}
