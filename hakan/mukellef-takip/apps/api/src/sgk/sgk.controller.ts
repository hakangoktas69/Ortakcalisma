import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PrismaService } from '../prisma.service.js';
import { VaultService } from '../vault/vault.service.js';
import { AuditService } from '../audit.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ViziteSyncService } from './vizite-sync.service.js';
import { SgkSyncProcessor } from './sgk-sync.processor.js';
import { ViziteError, parseSgkDate } from './vizite/vizite.types.js';
import { TescilSyncService } from './tescil-sync.service.js';
import { EBildirgeService } from './ebildirge/ebildirge.service.js';
import { TescilError } from './tescil/tescil.types.js';
import type { EmploymentEventType, ReportStatus } from '../generated/prisma/enums.js';

class CreateWorkplaceDto {
  @IsString() companyId: string;
  @Matches(/^[\d\s.-]{5,40}$/, { message: 'Sicil numarası rakamlardan oluşmalı' }) registryNo: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsBoolean() isBranch?: boolean;
}

class ViziteCredentialsDto {
  @Matches(/^\d{11}$/, { message: 'Kullanıcı kodu 11 haneli T.C. kimlik no olmalı' }) username: string;
  @Matches(/^\d{1,4}$/, { message: 'İşyeri kodu en fazla 4 haneli olmalı' }) workplaceCode: string;
  @IsString() @MinLength(1) password: string;
}

class TescilCredentialsDto {
  @IsString() @MinLength(3) username: string;
  @IsString() @MinLength(1) systemPassword: string;
  @IsString() @MinLength(1) workplacePassword: string;
}

class ApproveDto {
  @IsIn(['0', '1']) nitelikDurumu: '0' | '1';
  @Matches(/^\d{2}\.\d{2}\.\d{4}$/, { message: 'Tarih gg.aa.yyyy biçiminde olmalı' }) tarih: string;
}

// Şifre alanı hiçbir yanıtta dönmez; sadece girilip girilmediği bilgisi döner.
const workplaceSelect = {
  id: true,
  registryNo: true,
  name: true,
  isBranch: true,
  viziteUsername: true,
  viziteWorkplaceCode: true,
  viziteSecretEnc: true,
  credentialsUpdatedAt: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  tescilUsername: true,
  tescilSystemPasswordEnc: true,
  tescilCredentialsUpdatedAt: true,
  tescilLastSyncAt: true,
  tescilLastSyncStatus: true,
  tescilLastSyncError: true,
  company: { select: { id: true, title: true } },
  _count: { select: { reports: { where: { status: 'PENDING' as const } } } },
};

@Controller('sgk')
@UseGuards(AuthGuard)
export class SgkController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
    private readonly vizite: ViziteSyncService,
    private readonly tescil: TescilSyncService,
    private readonly ebildirge: EBildirgeService,
    private readonly queue: SgkSyncProcessor,
  ) {}

  private async ownWorkplace(id: string, tenantId: string) {
    const wp = await this.prisma.sgkWorkplace.findFirst({ where: { id, company: { tenantId } } });
    if (!wp) throw new NotFoundException('İşyeri bulunamadı');
    return wp;
  }

  @Get('workplaces')
  async workplaces(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.sgkWorkplace.findMany({
      where: { company: { tenantId: user.tenantId } },
      select: workplaceSelect,
      orderBy: [{ company: { title: 'asc' } }, { isBranch: 'asc' }],
    });
    return {
      mode: this.vizite.mode,
      tescilMode: this.tescil.mode,
      items: rows.map(({ viziteSecretEnc, tescilSystemPasswordEnc, _count, ...w }) => ({
        ...w,
        hasCredentials: !!viziteSecretEnc,
        hasTescilCredentials: !!tescilSystemPasswordEnc,
        pendingReports: _count.reports,
      })),
    };
  }

  @Post('workplaces')
  async createWorkplace(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkplaceDto) {
    const company = await this.prisma.company.findFirst({ where: { id: dto.companyId, tenantId: user.tenantId } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const wp = await this.prisma.sgkWorkplace.create({
      data: { companyId: company.id, registryNo: dto.registryNo, name: dto.name, isBranch: dto.isBranch ?? false },
    });
    return { id: wp.id };
  }

  /** Bilgileri önce SGK'da dener, giriş başarılıysa şifreleyip kaydeder. */
  @Put('workplaces/:id/vizite-credentials')
  async setCredentials(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ViziteCredentialsDto) {
    await this.ownWorkplace(id, user.tenantId);
    try {
      await this.vizite.testLogin({
        kullaniciAdi: dto.username,
        isyeriKodu: dto.workplaceCode,
        isyeriSifresi: dto.password,
      });
    } catch (e) {
      if (e instanceof ViziteError) throw new BadRequestException(`SGK girişi başarısız: ${e.message}`);
      throw e;
    }
    await this.prisma.sgkWorkplace.update({
      where: { id },
      data: {
        viziteUsername: dto.username,
        viziteWorkplaceCode: dto.workplaceCode,
        viziteSecretEnc: this.vault.encrypt(dto.password),
        credentialsUpdatedAt: new Date(),
      },
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'vizite.credentials.update', target: id });
    return { ok: true };
  }

  @Delete('workplaces/:id/vizite-credentials')
  async deleteCredentials(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.ownWorkplace(id, user.tenantId);
    await this.prisma.sgkWorkplace.update({
      where: { id },
      data: { viziteUsername: null, viziteWorkplaceCode: null, viziteSecretEnc: null, credentialsUpdatedAt: null },
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'vizite.credentials.delete', target: id });
    return { ok: true };
  }

  /** 4A bilgilerini önce doğrular, başarılıysa iki şifreyi ayrı ayrı şifreleyip kaydeder. */
  @Put('workplaces/:id/tescil-credentials')
  async setTescilCredentials(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TescilCredentialsDto) {
    await this.ownWorkplace(id, user.tenantId);
    try {
      await this.tescil.verify({
        kullaniciAdi: dto.username,
        sistemSifresi: dto.systemPassword,
        isyeriSifresi: dto.workplacePassword,
      });
    } catch (e) {
      if (e instanceof TescilError) throw new BadRequestException(`SGK girişi başarısız: ${e.message}`);
      throw e;
    }
    await this.prisma.sgkWorkplace.update({
      where: { id },
      data: {
        tescilUsername: dto.username,
        tescilSystemPasswordEnc: this.vault.encrypt(dto.systemPassword),
        tescilWorkplacePasswordEnc: this.vault.encrypt(dto.workplacePassword),
        tescilCredentialsUpdatedAt: new Date(),
      },
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'tescil.credentials.update', target: id });
    return { ok: true };
  }

  @Delete('workplaces/:id/tescil-credentials')
  async deleteTescilCredentials(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.ownWorkplace(id, user.tenantId);
    await this.prisma.sgkWorkplace.update({
      where: { id },
      data: {
        tescilUsername: null,
        tescilSystemPasswordEnc: null,
        tescilWorkplacePasswordEnc: null,
        tescilCredentialsUpdatedAt: null,
      },
    });
    await this.audit.log({ tenantId: user.tenantId, userId: user.sub, action: 'tescil.credentials.delete', target: id });
    return { ok: true };
  }

  /** Senkronu kuyruğa alır (işyeri verilmezse büronun tüm işyerleri). */
  @Post('sync')
  async sync(@CurrentUser() user: AuthUser, @Query('workplaceId') workplaceId?: string) {
    if (workplaceId) {
      await this.ownWorkplace(workplaceId, user.tenantId);
      const result = await this.queue.syncWorkplace(workplaceId, user.sub).catch((e: Error) => ({ error: e.message }));
      return { queued: 0, result };
    }
    return { queued: await this.queue.enqueueAll(user.tenantId, user.sub) };
  }

  @Get('reports')
  reports(@CurrentUser() user: AuthUser, @Query('status') status?: ReportStatus) {
    return this.prisma.sgkReport.findMany({
      where: {
        workplace: { company: { tenantId: user.tenantId } },
        ...(status === 'PENDING' || status === 'APPROVED' ? { status } : {}),
      },
      select: {
        id: true,
        tckn: true,
        fullName: true,
        vaka: true,
        vakaAdi: true,
        startDate: true,
        endDate: true,
        workControlDate: true,
        facilityName: true,
        status: true,
        approvedAt: true,
        workplace: { select: { id: true, registryNo: true, company: { select: { title: true } } } },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 500,
    });
  }

/** ?period=2026-09 | ?months=12 (varsayılan), ?workplaceId= */
  @Get('ebildirge')
  async ebildirgeList(
    @CurrentUser() user: AuthUser,
    @Query('period') period?: string,
    @Query('workplaceId') workplaceId?: string,
    @Query('months') months?: string,
  ) {
    const rows = await this.ebildirge.list(user.tenantId, {
      period: period && /^\d{4}-\d{2}$/.test(period) ? period : undefined,
      workplaceId: workplaceId || undefined,
      months: Number(months) || undefined,
    });
    return rows.map((r) => ({ ...r, premiumBase: r.premiumBase === null ? null : Number(r.premiumBase), accrualAmount: r.accrualAmount === null ? null : Number(r.accrualAmount) }));
  }

  @Get('employment')
  employment(
    @CurrentUser() user: AuthUser,
    @Query('type') type?: EmploymentEventType,
    @Query('days') days?: string,
  ) {
    const since = new Date(Date.now() - Math.min(Number(days) || 90, 400) * 86_400_000);
    return this.prisma.employmentEvent.findMany({
      where: {
        workplace: { company: { tenantId: user.tenantId } },
        eventDate: { gte: since },
        ...(type === 'ENTRY' || type === 'EXIT' ? { type } : {}),
      },
      select: {
        id: true,
        type: true,
        tckn: true,
        fullName: true,
        eventDate: true,
        occupationCode: true,
        exitReasonCode: true,
        exitReason: true,
        referenceNo: true,
        workplace: { select: { id: true, registryNo: true, company: { select: { title: true } } } },
      },
      orderBy: { eventDate: 'desc' },
      take: 500,
    });
  }

  @Post('reports/:id/approve')
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ApproveDto) {
    const tarih = parseSgkDate(dto.tarih);
    if (!tarih) throw new BadRequestException('Geçersiz tarih');
    try {
      return await this.vizite.approveReport(id, user.tenantId, user.sub, dto.nitelikDurumu, tarih);
    } catch (e) {
      if (e instanceof ViziteError) throw new BadRequestException(`SGK: ${e.message}`);
      throw e;
    }
  }
}
