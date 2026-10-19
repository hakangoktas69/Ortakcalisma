import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { BUILTIN_TEMPLATES, fieldLabel, placeholders } from './petition-templates.js';

const BUILTIN_PREFIX = 'builtin:';
const AUTO_FIELDS = new Set(['firma_unvani', 'vkn', 'vergi_dairesi', 'tarih', 'buro_adi', 'kullanici_adi']);

@Injectable()
export class PetitionsService {
  constructor(private readonly prisma: PrismaService) {}

  async templates(tenantId: string) {
    const custom = await this.prisma.petitionTemplate.findMany({
      where: { tenantId },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, category: true, body: true },
    });
    return [
      ...BUILTIN_TEMPLATES.map((t) => ({ id: BUILTIN_PREFIX + t.key, title: t.title, category: t.category, body: t.body, builtin: true })),
      ...custom.map((t) => ({ ...t, builtin: false })),
    ];
  }

  private async template(tenantId: string, id: string) {
    if (id.startsWith(BUILTIN_PREFIX)) {
      const t = BUILTIN_TEMPLATES.find((x) => BUILTIN_PREFIX + x.key === id);
      if (!t) throw new NotFoundException('Şablon bulunamadı');
      return { id, title: t.title, body: t.body, dbId: null as string | null };
    }
    const t = await this.prisma.petitionTemplate.findFirst({ where: { id, tenantId } });
    if (!t) throw new NotFoundException('Şablon bulunamadı');
    return { id, title: t.title, body: t.body, dbId: t.id };
  }

  /** Şablonu seçilen firma için hazırlar: otomatik alanları doldurur, kalan alanları listeler. */
  async prepare(tenantId: string, userId: string, templateId: string, companyId: string) {
    const [t, company, user] = await Promise.all([
      this.template(tenantId, templateId),
      this.prisma.company.findFirst({ where: { id: companyId, tenantId }, select: { title: true, taxNumber: true, taxOffice: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { fullName: true, tenant: { select: { name: true } } } }),
    ]);
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const auto: Record<string, string> = {
      firma_unvani: company.title,
      vkn: company.taxNumber,
      vergi_dairesi: (company.taxOffice ?? '').toLocaleUpperCase('tr'),
      tarih: new Date().toLocaleDateString('tr-TR'),
      buro_adi: user.tenant.name,
      kullanici_adi: user.fullName,
    };
    return {
      templateId: t.id,
      title: t.title,
      body: t.body,
      fields: placeholders(t.body).map((key) => ({
        key,
        label: fieldLabel(key),
        auto: AUTO_FIELDS.has(key),
        value: auto[key] ?? '',
        multiline: key === 'aciklama',
      })),
    };
  }

  async save(tenantId: string, userId: string, input: { companyId: string; templateId?: string; title: string; content: string }) {
    const company = await this.prisma.company.findFirst({ where: { id: input.companyId, tenantId }, select: { id: true } });
    if (!company) throw new NotFoundException('Firma bulunamadı');
    const dbTemplateId = input.templateId && !input.templateId.startsWith(BUILTIN_PREFIX) ? (await this.template(tenantId, input.templateId)).dbId : null;
    return this.prisma.petition.create({
      data: { companyId: company.id, templateId: dbTemplateId, title: input.title, content: input.content, createdById: userId },
      select: { id: true, createdAt: true },
    });
  }

  list(tenantId: string, companyId?: string) {
    return this.prisma.petition.findMany({
      where: { company: { tenantId }, ...(companyId ? { companyId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, title: true, createdAt: true, company: { select: { id: true, title: true } } },
    });
  }

  async get(tenantId: string, id: string) {
    const p = await this.prisma.petition.findFirst({
      where: { id, company: { tenantId } },
      select: { id: true, title: true, content: true, createdAt: true, company: { select: { id: true, title: true } } },
    });
    if (!p) throw new NotFoundException('Dilekçe bulunamadı');
    return p;
  }

  async remove(tenantId: string, id: string) {
    const { count } = await this.prisma.petition.deleteMany({ where: { id, company: { tenantId } } });
    if (!count) throw new NotFoundException('Dilekçe bulunamadı');
  }

  createTemplate(tenantId: string, input: { title: string; category: string; body: string }) {
    return this.prisma.petitionTemplate.create({ data: { tenantId, ...input }, select: { id: true } });
  }

  async updateTemplate(tenantId: string, id: string, input: { title: string; category: string; body: string }) {
    const { count } = await this.prisma.petitionTemplate.updateMany({ where: { id, tenantId }, data: input });
    if (!count) throw new NotFoundException('Şablon bulunamadı (hazır şablonlar değiştirilemez; kopyalayıp düzenleyin)');
  }

  async deleteTemplate(tenantId: string, id: string) {
    const { count } = await this.prisma.petitionTemplate.deleteMany({ where: { id, tenantId } });
    if (!count) throw new NotFoundException('Şablon bulunamadı');
  }
}
