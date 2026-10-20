import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { createRlsPool } from './rls-pool.js';

/**
 * Tek veritabanı bağlantı havuzu. Sorgular çağıranın büro bağlamıyla (tenant-context.ts) çalışır;
 * PostgreSQL RLS politikaları diğer büroların satırlarını gizler. Uygulama yine de her sorguda tenantId filtreler.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg(createRlsPool({ connectionString: process.env.DATABASE_URL!, max: Number(process.env.DATABASE_POOL_MAX ?? 10) }), {
        disposeExternalPool: true,
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
