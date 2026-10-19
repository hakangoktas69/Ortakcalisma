import { BadRequestException, Controller, Delete, Get, Param, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from '../audit.service.js';
import { InvoicesService } from './invoices.service.js';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, type UploadedInvoiceFile } from './invoice-files.js';

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

function period(v: string | undefined, required = false) {
  if (!v) {
    if (required) throw new BadRequestException('Dönem (YYYY-AA) gerekli');
    return undefined;
  }
  if (!PERIOD.test(v)) throw new BadRequestException('Dönem YYYY-AA biçiminde olmalı');
  return v;
}

@Controller('invoices')
@UseGuards(AuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Entegratörden indirilen UBL-TR fatura dosyaları (.xml veya .zip, birden çok dosya).
   * ?dryRun=false gelene kadar hiçbir şey yazılmaz.
   */
  @Post('import')
  @UseInterceptors(
    FilesInterceptor('files', MAX_UPLOAD_FILES, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
    }),
  )
  async import(@CurrentUser() user: AuthUser, @UploadedFiles() files: UploadedInvoiceFile[] | undefined, @Query('dryRun') dryRunRaw?: string) {
    if (!files?.length) throw new BadRequestException('Dosya seçin (.xml veya .zip)');
    if (files.reduce((s, f) => s + f.buffer.length, 0) > MAX_UPLOAD_BYTES)
      throw new BadRequestException(`Toplam boyut en fazla ${MAX_UPLOAD_BYTES / 1024 / 1024} MB olabilir`);
    const dryRun = dryRunRaw !== 'false';
    let result;
    try {
      result = await this.invoices.importFiles(user.tenantId, files, dryRun);
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Dosyalar okunamadı');
    }
    if (!dryRun) {
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'invoices.import',
        detail: { files: files.length, xml: result.files, create: result.create, duplicate: result.duplicate, errors: result.errorCount },
      });
    }
    return result;
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('companyId') companyId?: string,
    @Query('period') p?: string,
    @Query('direction') direction?: string,
    @Query('q') search?: string,
    @Query('skip') skip?: string,
  ) {
    return this.invoices.list(user.tenantId, {
      companyId: companyId || undefined,
      period: period(p),
      direction: direction === 'OUTGOING' || direction === 'INCOMING' ? direction : undefined,
      search: search?.trim().slice(0, 60) || undefined,
      skip: Number(skip) || 0,
    });
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query('period') p?: string) {
    return this.invoices.overview(user.tenantId, period(p, true)!);
  }

  @Get('kdv')
  kdv(@CurrentUser() user: AuthUser, @Query('companyId') companyId?: string, @Query('period') p?: string) {
    if (!companyId) throw new BadRequestException('Firma gerekli');
    return this.invoices.kdv(user.tenantId, companyId, period(p, true)!);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.invoices.remove(user.tenantId, id);
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'invoices.delete', target: id });
    return r;
  }
}
