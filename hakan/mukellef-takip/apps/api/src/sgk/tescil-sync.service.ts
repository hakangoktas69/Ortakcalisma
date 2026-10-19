import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { VaultService } from '../vault/vault.service.js';
import { AuditService } from '../audit.service.js';
import {
  TESCIL_CLIENT,
  TescilError,
  type TescilClient,
  type TescilCredentials,
  type TescilRecord,
} from './tescil/tescil.types.js';
import type { EmploymentEventType } from '../generated/prisma/enums.js';

// İlk senkronda yılbaşından bugüne, sonrakilerde son senkrondan 7 gün öncesinden itibaren
// (geriye dönük verilen bildirgeleri de yakalamak için).
const OVERLAP_DAYS = 7;

@Injectable()
export class TescilSyncService {
  private readonly logger = new Logger(TescilSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly audit: AuditService,
    @Inject(TESCIL_CLIENT) private readonly client: TescilClient,
  ) {}

  get mode() {
    return this.client.mode;
  }

  verify(creds: TescilCredentials) {
    return this.client.verify(creds);
  }

  private async credentialsFor(workplaceId: string, userId: string | null) {
    const wp = await this.prisma.sgkWorkplace.findUnique({
      where: { id: workplaceId },
      include: { company: { select: { tenantId: true } } },
    });
    if (!wp) throw new NotFoundException('İşyeri bulunamadı');
    if (!wp.tescilUsername || !wp.tescilSystemPasswordEnc || !wp.tescilWorkplacePasswordEnc) {
      throw new TescilError('NO_CREDENTIALS', '4A giriş bilgileri girilmemiş');
    }
    await this.audit.log({ tenantId: wp.company.tenantId, userId, action: 'tescil.credentials.decrypt', target: wp.id });
    const creds: TescilCredentials = {
      kullaniciAdi: wp.tescilUsername,
      sistemSifresi: this.vault.decrypt(wp.tescilSystemPasswordEnc),
      isyeriSifresi: this.vault.decrypt(wp.tescilWorkplacePasswordEnc),
    };
    return { wp, creds };
  }

  async syncWorkplace(workplaceId: string, userId: string | null = null) {
    await this.prisma.sgkWorkplace.update({ where: { id: workplaceId }, data: { tescilLastSyncStatus: 'RUNNING' } });
    try {
      const { wp, creds } = await this.credentialsFor(workplaceId, userId);
      const to = new Date();
      const from = wp.tescilLastSyncAt
        ? new Date(wp.tescilLastSyncAt.getTime() - OVERLAP_DAYS * 86_400_000)
        : new Date(to.getFullYear(), 0, 1);

      const [entries, exits] = await Promise.all([
        this.client.entries(creds, from, to),
        this.client.exits(creds, from, to),
      ]);
      for (const r of entries) await this.upsert(workplaceId, 'ENTRY', r);
      for (const r of exits) await this.upsert(workplaceId, 'EXIT', r);

      await this.prisma.sgkWorkplace.update({
        where: { id: workplaceId },
        data: { tescilLastSyncStatus: 'OK', tescilLastSyncAt: to, tescilLastSyncError: null },
      });
      return { entries: entries.length, exits: exits.length };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(`İşyeri ${workplaceId} 4A senkron hatası: ${message}`);
      await this.prisma.sgkWorkplace.update({
        where: { id: workplaceId },
        data: { tescilLastSyncStatus: 'ERROR', tescilLastSyncError: message.slice(0, 500) },
      });
      throw e;
    }
  }

  private upsert(workplaceId: string, type: EmploymentEventType, r: TescilRecord) {
    const data = {
      fullName: `${r.ad} ${r.soyad}`.trim(),
      insuranceType: r.sigortaliTuru ?? null,
      occupationCode: r.meslekKodu ?? null,
      exitReasonCode: r.ayrilisNedeniKodu ?? null,
      exitReason: r.ayrilisNedeni ?? null,
      referenceNo: r.referansNo ?? null,
      raw: { ...r, tarih: r.tarih.toISOString() },
    };
    return this.prisma.employmentEvent.upsert({
      where: { workplaceId_type_tckn_eventDate: { workplaceId, type, tckn: r.tckn, eventDate: r.tarih } },
      create: { workplaceId, type, tckn: r.tckn, eventDate: r.tarih, ...data },
      update: data,
    });
  }
}
