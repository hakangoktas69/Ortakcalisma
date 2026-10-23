import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../core.js';
import { config } from '../config.js';

/**
 * Satış rolüyle (mukellef_satis → sales_user) bağlanır. Büro bağlamı (app.tenant_id) kurulmaz: satış rolünün
 * RLS politikası tüm büroları gösterir, ama yalnız izin verilen tablo ve kolonlara erişebilir
 * (migration satis_modulu). Mükellef, beyanname, SGK vb. tablolara sorgu veritabanında reddedilir.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: config().DATABASE_URL, max: 5 }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
