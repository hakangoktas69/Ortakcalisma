import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString, Matches } from 'class-validator';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from '../audit.service.js';
import { PayrollService } from './payroll.service.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

class ImportPayrollDto {
  @IsString() companyId: string;
  @IsOptional() @IsString() workplaceId?: string;
  @Matches(PERIOD, { message: 'Dönem YYYY-AA biçiminde olmalı' }) period: string;
}

@Controller('payroll')
@UseGuards(AuthGuard)
export class PayrollController {
  constructor(
    private readonly payroll: PayrollService,
    private readonly audit: AuditService,
  ) {}

  @Get('template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="bordro-sablonu.xlsx"')
  async template() {
    return new StreamableFile(await this.payroll.template());
  }

  /** Bordro programının personel bazlı Excel/CSV çıktısı. ?dryRun=false gelene kadar hiçbir şey yazılmaz. */
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => cb(null, /\.(xlsx|csv)$/i.test(file.originalname)),
    }),
  )
  async import(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
    @Body() dto: ImportPayrollDto,
    @Query('dryRun') dryRunRaw?: string,
  ) {
    if (!file) throw new BadRequestException('Dosya seçin (.xlsx veya .csv, en fazla 5 MB)');
    const dryRun = dryRunRaw !== 'false';
    const result = await this.payroll.importFile(user.tenantId, user.sub, file, dto, dryRun);
    if (!dryRun) {
      // Denetim kaydına kişi bilgisi yazılmaz; sadece özet
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'payroll.import',
        target: result.runId ?? undefined,
        detail: { companyId: result.company.id, period: result.period, employees: result.totals.employeeCount, replaced: !!result.replaces },
      });
    }
    return result;
  }

  @Get('overview')
  overview(@CurrentUser() user: AuthUser, @Query('period') period?: string) {
    if (!period || !PERIOD.test(period)) throw new BadRequestException('Dönem YYYY-AA biçiminde olmalı');
    return this.payroll.overview(user.tenantId, period);
  }

  @Get('runs/:id')
  run(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payroll.run(user.tenantId, id);
  }

  @Delete('runs/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const r = await this.payroll.remove(user.tenantId, id);
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'payroll.delete', target: id });
    return r;
  }
}
