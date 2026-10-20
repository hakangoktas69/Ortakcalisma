import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { runAsSystem } from '../database/tenant-context.js';
import { PersonalDataService } from './personal-data.js';

const BATCH = 500;

/**
 * Şifreleme öncesi yazılmış kişi alanlarını (TCKN, ad soyad) şifreler ve düz kolonları boşaltır;
 * SGK'nın ham satırlarını (raw) siler (veri minimizasyonu). Worker açılışında arka planda çalışır,
 * işlenecek kayıt kalmayınca hiçbir şey yapmaz. Birden fazla worker aynı anda çalıştırsa da güvenlidir (idempotent).
 * Bittikten sonra düz kolonlar bir migration ile kaldırılabilir.
 */
@Injectable()
export class PersonalDataBackfill implements OnApplicationBootstrap {
  private readonly logger = new Logger(PersonalDataBackfill.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly personal: PersonalDataService,
  ) {}

  onApplicationBootstrap() {
    void runAsSystem(() => this.run()).catch((e: Error) => this.logger.error(`Kişisel veri dönüşümü başarısız: ${e.message}`));
  }

  async run() {
    const counts = { sgkReport: await this.reports(), employment: await this.employment(), payroll: await this.payroll() };
    if (counts.sgkReport + counts.employment + counts.payroll > 0) this.logger.log(`Kişisel veri şifrelendi: ${JSON.stringify(counts)}`);
  }

  private async reports() {
    let n = 0;
    await this.prisma.sgkReport.updateMany({ where: { raw: { not: Prisma.DbNull } }, data: { raw: Prisma.DbNull } });
    for (;;) {
      const rows = await this.prisma.sgkReport.findMany({ where: { tcknEnc: null, tckn: { not: null } }, select: { id: true, tckn: true, fullName: true }, take: BATCH });
      if (!rows.length) return n;
      for (const r of rows) await this.prisma.sgkReport.update({ where: { id: r.id }, data: this.personal.seal({ tckn: r.tckn!, fullName: r.fullName ?? '' }) });
      n += rows.length;
    }
  }

  private async employment() {
    let n = 0;
    await this.prisma.employmentEvent.updateMany({ where: { raw: { not: Prisma.DbNull } }, data: { raw: Prisma.DbNull } });
    for (;;) {
      const rows = await this.prisma.employmentEvent.findMany({
        where: { tcknEnc: null, tckn: { not: null } },
        select: { id: true, workplaceId: true, type: true, eventDate: true, tckn: true, fullName: true },
        take: BATCH,
      });
      if (!rows.length) return n;
      for (const r of rows) {
        const sealed = this.personal.seal({ tckn: r.tckn!, fullName: r.fullName ?? '' });
        // Şifreli kayıt zaten varsa (dönüşümden önce yeni senkron yazdıysa) eski kopya silinir
        const dup = await this.prisma.employmentEvent.findUnique({
          where: { workplaceId_type_tcknHash_eventDate: { workplaceId: r.workplaceId, type: r.type, tcknHash: sealed.tcknHash, eventDate: r.eventDate } },
          select: { id: true },
        });
        if (dup && dup.id !== r.id) await this.prisma.employmentEvent.delete({ where: { id: r.id } });
        else await this.prisma.employmentEvent.update({ where: { id: r.id }, data: sealed });
      }
      n += rows.length;
    }
  }

  private async payroll() {
    let n = 0;
    for (;;) {
      const rows = await this.prisma.payrollLine.findMany({ where: { tcknEnc: null, tckn: { not: null } }, select: { id: true, tckn: true, fullName: true }, take: BATCH });
      if (!rows.length) return n;
      for (const r of rows) await this.prisma.payrollLine.update({ where: { id: r.id }, data: this.personal.seal({ tckn: r.tckn!, fullName: r.fullName ?? '' }) });
      n += rows.length;
    }
  }
}
