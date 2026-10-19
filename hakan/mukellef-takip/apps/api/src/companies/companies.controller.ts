import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { CompanyType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma.service.js';
import { AdminGuard, AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { AuditService } from '../audit.service.js';
import { MAX_UPLOAD_BYTES, buildTemplate, readSheet, toImportRows } from './company-import.js';

class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  title: string;

  @Matches(/^\d{10,11}$/, { message: 'VKN 10, TCKN 11 haneli olmalı' })
  taxNumber: string;

  @IsEnum(CompanyType)
  type: CompanyType;

  @IsOptional() @IsString() taxOffice?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

/** Multer'ın bellekte tuttuğu yüklenen dosyadan kullandığımız alanlar */
interface UploadedSheet {
  originalname: string;
  buffer: Buffer;
}

class UpdateCompanyDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsEnum(CompanyType) type?: CompanyType;
  @IsOptional() @IsString() taxOffice?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}

@Controller('companies')
@UseGuards(AuthGuard)
export class CompaniesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('import/template')
  async template(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="firma-aktarim-sablonu.xlsx"');
    return new StreamableFile(await buildTemplate());
  }

  /**
   * Excel/CSV'den firma aktarımı (sadece yönetici). ?dryRun=false gelene kadar hiçbir şey yazılmaz.
   * Aynı VKN portalda varsa güncellenir (boş hücreler mevcut bilgiyi silmez), yoksa eklenir.
   * Kota aşılırsa fazla satırlar eklenmez ve hata olarak gösterilir.
   */
  @Post('import')
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => cb(null, /\.(xlsx|csv)$/i.test(file.originalname)),
    }),
  )
  async import(@CurrentUser() user: AuthUser, @UploadedFile() file: UploadedSheet | undefined, @Query('dryRun') dryRunRaw?: string) {
    if (!file) throw new BadRequestException('Dosya seçin (.xlsx veya .csv, en fazla 2 MB)');
    const dryRun = dryRunRaw !== 'false';
    let parsed;
    try {
      parsed = toImportRows(await readSheet(file.buffer, file.originalname));
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Dosya okunamadı');
    }
    if (parsed.error) throw new BadRequestException(parsed.error);

    const [existing, sub, count] = await Promise.all([
      this.prisma.company.findMany({
        where: { tenantId: user.tenantId, taxNumber: { in: parsed.rows.map((r) => r.taxNumber).filter(Boolean) } },
        select: { id: true, taxNumber: true, title: true },
      }),
      this.prisma.subscription.findUnique({ where: { tenantId: user.tenantId } }),
      this.prisma.company.count({ where: { tenantId: user.tenantId } }),
    ]);
    if (!sub || sub.expiresAt < new Date()) throw new ForbiddenException('Lisans süresi dolmuş');
    const byVkn = new Map(existing.map((c) => [c.taxNumber, c]));
    let room = sub.companyQuota - count;

    const rows = parsed.rows.map((r) => {
      const ex = byVkn.get(r.taxNumber);
      let action: 'create' | 'update' | 'error' = r.errors.length ? 'error' : ex ? 'update' : 'create';
      if (action === 'create') {
        if (room > 0) room--;
        else {
          action = 'error';
          r.errors.push(`Firma kotası dolu (${sub.companyQuota})`);
        }
      }
      return { ...r, action, existingTitle: ex?.title ?? null };
    });

    if (!dryRun) {
      for (const r of rows) {
        if (r.action === 'create') {
          await this.prisma.company.create({
            data: { tenantId: user.tenantId, title: r.title, taxNumber: r.taxNumber, type: r.type!, taxOffice: r.taxOffice, phone: r.phone, email: r.email },
          });
        } else if (r.action === 'update') {
          // Sadece dolu hücreler: Excel'de boş bırakılan alan mevcut bilgiyi silmez
          await this.prisma.company.update({
            where: { id: byVkn.get(r.taxNumber)!.id },
            data: {
              title: r.title,
              ...(r.type && !r.warnings.some((w) => w.includes('varsayıldı')) ? { type: r.type } : {}),
              ...(r.taxOffice ? { taxOffice: r.taxOffice } : {}),
              ...(r.phone ? { phone: r.phone } : {}),
              ...(r.email ? { email: r.email } : {}),
            },
          });
        }
      }
      await this.audit.log({
        tenantId: user.tenantId,
        userId: user.sub,
        action: 'companies.import',
        detail: { file: file.originalname, create: rows.filter((r) => r.action === 'create').length, update: rows.filter((r) => r.action === 'update').length },
      });
    }

    const n = (a: string) => rows.filter((r) => r.action === a).length;
    return { dryRun, total: rows.length, create: n('create'), update: n('update'), error: n('error'), quota: sub.companyQuota, used: count, rows };
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('q') q?: string, @Query('type') type?: CompanyType) {
    return this.prisma.company.findMany({
      where: {
        tenantId: user.tenantId,
        ...(type ? { type } : {}),
        ...(q
          ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { taxNumber: { contains: q } }] }
          : {}),
      },
      orderBy: { title: 'asc' },
    });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    const [count, sub] = await Promise.all([
      this.prisma.company.count({ where: { tenantId: user.tenantId } }),
      this.prisma.subscription.findUnique({ where: { tenantId: user.tenantId } }),
    ]);
    if (!sub || sub.expiresAt < new Date()) throw new ForbiddenException('Lisans süresi dolmuş');
    if (count >= sub.companyQuota) throw new ForbiddenException('Firma kotası dolu');
    return this.prisma.company.create({ data: { ...dto, tenantId: user.tenantId } });
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const { count } = await this.prisma.company.updateMany({
      where: { id, tenantId: user.tenantId },
      data: dto,
    });
    if (!count) throw new NotFoundException();
    return this.prisma.company.findUnique({ where: { id } });
  }
}
