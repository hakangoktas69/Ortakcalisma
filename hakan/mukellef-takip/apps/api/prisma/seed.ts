import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, CompanyType } from '../src/generated/prisma/client.js';
import { VaultService } from '../src/vault/vault.service.js';
import { DEFAULT_OBLIGATIONS } from '../src/declarations/declaration-rules.js';
import { MockGibSource } from '../src/declarations/gib/gib-source.js';
import { deemedServedDate } from '../src/tebligat/tebligat-parser.js';
import { periodForMonth, ruleDueDate } from '../src/edefter/edefter-rules.js';
import { randomUUID } from 'node:crypto';
import { buildUblInvoice } from '../src/invoices/ubl-sample.js';
import { parseUblInvoice } from '../src/invoices/ubl-parser.js';
import { makeTckn } from '../src/payroll/test-tckn.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// Demo giriş bilgileri (sadece yerel geliştirme için)
const DEMO_EMAIL = 'demo@mukellef.test';
const DEMO_PASSWORD = 'Demo1234!';
// İkinci (personel) kullanıcı: kullanıcı yönetimi ve yetki testleri için
const STAFF_EMAIL = 'personel@mukellef.test';
const STAFF_PASSWORD = 'Personel2026';

const firstNames = ['Ahmet', 'Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Zeynep', 'Mustafa', 'Elif', 'Hasan', 'Emine'];
const lastNames = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan'];
const sectors = ['Gıda', 'İnşaat', 'Tekstil', 'Lojistik', 'Yazılım', 'Otomotiv', 'Turizm', 'Mobilya'];

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  await prisma.tenant.deleteMany();
  await prisma.taxCalendarEvent.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Mali Müşavirlik',
      subscription: {
        create: { plan: 'pro', companyQuota: 150, expiresAt: addDays(new Date(), 359) },
      },
      users: {
        create: {
          email: DEMO_EMAIL,
          fullName: 'Demo Kullanıcı',
          role: 'ADMIN',
          passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: STAFF_EMAIL,
      fullName: 'Demo Personel',
      role: 'STAFF',
      passwordHash: await bcrypt.hash(STAFF_PASSWORD, 10),
    },
  });

  const companies = [];
  for (let i = 0; i < 40; i++) {
    const type: CompanyType = i % 3 === 0 ? 'SIRKET' : i % 7 === 0 ? 'BASIT_USUL' : 'SAHIS';
    const person = `${firstNames[i % 10]} ${lastNames[(i * 3) % 10]}`;
    companies.push({
      tenantId: tenant.id,
      type,
      title: type === 'SIRKET' ? `${lastNames[i % 10]} ${sectors[i % 8]} Ltd. Şti.` : person,
      taxNumber: type === 'SIRKET' ? String(1000000000 + i * 7919) : String(10000000000 + i * 104729),
      taxOffice: ['Kadıköy', 'Beşiktaş', 'Çankaya', 'Konak', 'Nilüfer'][i % 5],
      isActive: i % 13 !== 0,
    });
  }
  await prisma.company.createMany({ data: companies });

  // SGK işyerleri: aktif firmaların ilk 12'si, 2 tanesine ek şube.
  // Demo modunda (SGK_MODE=mock) şifresi "hatali" olan işyeri giriş hatası verir
  // (Vizite: 12. işyeri, 4A: 11. işyeri).
  const vault = new VaultService();
  const active = await prisma.company.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { title: 'asc' },
    take: 12,
  });
  for (const [i, c] of active.entries()) {
    const branches = i < 2 ? 2 : 1;
    for (let b = 0; b < branches; b++) {
      await prisma.sgkWorkplace.create({
        data: {
          companyId: c.id,
          registryNo: `2 5510 01 01 ${String(1000000 + i * 37 + b).slice(0, 7)} 034 01 ${String(10 + b).padStart(2, '0')}`,
          name: b === 0 ? 'Merkez' : `Şube ${b}`,
          isBranch: b > 0,
          viziteUsername: '11111111110',
          viziteWorkplaceCode: String(1000 + i * 10 + b),
          viziteSecretEnc: vault.encrypt(i === 11 ? 'hatali' : 'demo-sifre'),
          credentialsUpdatedAt: new Date(),
          // 4A bilgileri: Vizite'den bağımsız; demo hatası farklı bir işyerinde (i === 10)
          tescilUsername: `demo${i}-${b}`, // her işyerinin kendi e-Bildirge kullanıcısı var
          tescilSystemPasswordEnc: vault.encrypt(i === 10 ? 'hatali' : 'demo-sistem'),
          tescilWorkplacePasswordEnc: vault.encrypt('demo-isyeri'),
          tescilCredentialsUpdatedAt: new Date(),
        },
      });
    }
  }

  // Demo faturalar: aktif şirketlerin ilk 8'i, son 3 ay; satış ve alışlar örnek UBL-TR XML'den üretilip
  // gerçek ayrıştırıcıdan geçirilir. Bazılarında KDV tevkifatı, birinde dövizli satış var.
  const invoiceCompanies = await prisma.company.findMany({
    where: { tenantId: tenant.id, isActive: true, type: 'SIRKET' },
    orderBy: { title: 'asc' },
    take: 8,
  });
  const counterparties = [
    { taxNumber: '3880012345', name: 'Anadolu Toptan Gıda A.Ş.' },
    { taxNumber: '4510098765', name: 'Marmara Kırtasiye Ltd. Şti.' },
    { taxNumber: '6120034567', name: 'Ege Lojistik A.Ş.' },
    { taxNumber: '7340056789', name: 'Başkent Temizlik Hizmetleri Ltd. Şti.' },
    { taxNumber: '8120011223', name: 'Karadeniz Enerji A.Ş.' },
  ];
  const items = [
    { name: 'Danışmanlık hizmeti', unitPrice: 12500, vatRate: 20 },
    { name: 'Ofis malzemesi', unitPrice: 850, vatRate: 20 },
    { name: 'Gıda ürünleri', unitPrice: 1200, vatRate: 1 },
    { name: 'Kitap', unitPrice: 300, vatRate: 10 },
    { name: 'Temizlik hizmeti', unitPrice: 9000, vatRate: 20 },
  ];
  const invoiceRows = [];
  for (const [ci, c] of invoiceCompanies.entries()) {
    const self = { taxNumber: c.taxNumber, name: c.title };
    for (let back = 1; back <= 3; back++) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - back, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      for (let n = 0; n < 6 + ((ci + back) % 4); n++) {
        const outgoing = n % 3 !== 2;
        const other = counterparties[(ci + n + back) % counterparties.length];
        const item = items[(ci * 3 + n) % items.length];
        const day = String(1 + ((n * 4 + ci) % 27)).padStart(2, '0');
        const xml = buildUblInvoice({
          uuid: randomUUID(),
          number: `${outgoing ? 'DMO' : 'GLN'}${d.getFullYear()}${String(back * 1000 + ci * 50 + n).padStart(9, '0')}`,
          issueDate: `${ym}-${day}`,
          profile: n === 4 ? 'EARSIVFATURA' : 'TICARIFATURA',
          supplier: outgoing ? self : other,
          customer: outgoing ? other : self,
          lines: [{ ...item, quantity: 1 + ((n + ci) % 5) }],
          withholdingRatio: item.name === 'Temizlik hizmeti' ? 0.9 : undefined,
          ...(outgoing && n === 1 && ci === 0 ? { currency: 'EUR', exchangeRate: 37.25 } : {}),
        });
        const parsed = parseUblInvoice(xml);
        if (!parsed.ok) throw new Error(parsed.error);
        const inv = parsed.invoice;
        const cp = outgoing ? inv.customer : inv.supplier;
        invoiceRows.push({
          companyId: c.id,
          direction: outgoing ? ('OUTGOING' as const) : ('INCOMING' as const),
          uuid: inv.uuid,
          number: inv.number,
          issueDate: new Date(`${inv.issueDate}T00:00:00Z`),
          period: inv.issueDate.slice(0, 7),
          profile: inv.profile,
          invoiceType: inv.invoiceType,
          counterpartyTaxNumber: cp.taxNumber,
          counterpartyName: cp.name,
          currency: inv.currency,
          exchangeRate: inv.exchangeRate,
          lineExtensionAmount: inv.lineExtensionAmount,
          taxExclusiveAmount: inv.taxExclusiveAmount,
          taxInclusiveAmount: inv.taxInclusiveAmount,
          payableAmount: inv.payableAmount,
          vatAmount: inv.vatAmount,
          withholdingAmount: inv.withholdingAmount,
          taxes: inv.taxes.map((t) => ({ ...t })),
          lineCount: inv.lineCount,
          source: 'DEMO' as const,
        });
      }
    }
  }
  await prisma.invoice.createMany({ data: invoiceRows });

  // Demo e-Bildirge belgeleri: son 3 dönem, her işyerine bir asıl belge (01 / 05510); bazılarına ek belge.
  // Son iki işyeri hiç aktarılmamış gibi bırakılır.
  const wps = await prisma.sgkWorkplace.findMany({ where: { company: { tenantId: tenant.id } }, orderBy: { registryNo: 'asc' } });
  for (const [i, wp] of wps.slice(0, -2).entries()) {
    for (let back = 1; back <= 3; back++) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - back, 1);
      const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const insured = 3 + ((i * 7 + back) % 18);
      const premiumBase = Math.round(insured * 30 * 1100 * 100) / 100;
      const docs = [{ kind: 'ASIL', insured, days: insured * 30, premiumBase }];
      if (i % 4 === 1 && back === 2) docs.push({ kind: 'EK', insured: 1, days: 5, premiumBase: 5500 });
      for (const doc of docs) {
        await prisma.eBildirgeDocument.create({
          data: {
            workplaceId: wp.id,
            period,
            documentType: '01',
            lawNo: '05510',
            kind: doc.kind,
            insuredCount: doc.insured,
            totalDays: doc.days,
            premiumBase: doc.premiumBase,
            accrualAmount: Math.round(doc.premiumBase * 0.375 * 100) / 100,
            approvedAt: new Date(d.getFullYear(), d.getMonth() + 1, 20 + (i % 5)),
            referenceNo: `DEMO-${period}-${i}-${doc.kind}`,
            source: 'DEMO',
          },
        });
      }
    }
  }

  // Demo bordrolar: son dönem, e-Bildirge'si olan ilk 8 işyeri. Çoğu e-Bildirge ile birebir uyumlu;
  // biri bilerek eksik günlü (mutabakat farkı), birinde SGK işçi payı yanlış (satır uyarısı).
  // Bir işyerinin bordrosu yüklenmemiş bırakılır ("bordrosu eksik" listesi için).
  const lastPeriodDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const lastPeriod = `${lastPeriodDate.getFullYear()}-${String(lastPeriodDate.getMonth() + 1).padStart(2, '0')}`;
  const payrollDocs = await prisma.eBildirgeDocument.findMany({
    where: { period: lastPeriod, kind: 'ASIL', workplace: { company: { tenantId: tenant.id } } },
    include: { workplace: true },
    orderBy: { workplace: { registryNo: 'asc' } },
    take: 8,
  });
  for (const [wi, doc] of payrollDocs.slice(0, 7).entries()) {
    const lines = Array.from({ length: doc.insuredCount ?? 0 }, (_, k) => {
      const days = wi === 2 && k === 0 ? 25 : 30;
      const sgkBase = days * 1100;
      const employeeSgk = wi === 4 && k === 1 ? 4000 : Math.round(sgkBase * 14) / 100;
      const employeeUnemployment = Math.round(sgkBase) / 100;
      return {
        tckn: makeTckn(String(100000000 + wi * 1000 + k * 7)),
        fullName: `${firstNames[(wi + k) % 10]} ${lastNames[(wi * 3 + k) % 10]}`,
        days,
        gross: sgkBase,
        sgkBase,
        employeeSgk,
        employeeUnemployment,
        incomeTax: 0,
        stampTax: 0,
        net: Math.round((sgkBase - employeeSgk - employeeUnemployment) * 100) / 100,
        warnings: wi === 4 && k === 1 ? [`SGK işçi payı matrahın %14'üne uymuyor (beklenen ${(sgkBase * 0.14).toFixed(2)})`] : [],
      };
    });
    const sum = (f: (l: (typeof lines)[number]) => number) => Math.round(lines.reduce((s, l) => s + f(l), 0) * 100) / 100;
    await prisma.payrollRun.create({
      data: {
        companyId: doc.workplace.companyId,
        workplaceId: doc.workplaceId,
        workplaceKey: doc.workplaceId,
        period: lastPeriod,
        source: 'DEMO',
        fileName: 'demo-bordro.xlsx',
        employeeCount: lines.length,
        totalDays: lines.reduce((s, l) => s + l.days, 0),
        gross: sum((l) => l.gross),
        sgkBase: sum((l) => l.sgkBase),
        employeeSgk: sum((l) => l.employeeSgk),
        employeeUnemployment: sum((l) => l.employeeUnemployment),
        incomeTax: 0,
        stampTax: 0,
        net: sum((l) => l.net),
        warningCount: lines.filter((l) => l.warnings.length).length,
        lines: { create: lines },
      },
    });
  }

  // Beyanname yükümlülükleri (türe göre varsayılan) ve son 3 ayın demo GİB beyannameleri
  const all = await prisma.company.findMany({ where: { tenantId: tenant.id }, select: { id: true, type: true, taxNumber: true } });
  await prisma.companyObligation.createMany({
    data: all.flatMap((c) => DEFAULT_OBLIGATIONS[c.type].map((type) => ({ companyId: c.id, type }))),
  });
  const gib = new MockGibSource();
  const idByVkn = new Map(all.map((c) => [c.taxNumber, c.id]));
  for (let back = 1; back <= 3; back++) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - back, 1);
    const filed = await gib.filed([...idByVkn.keys()], d.getFullYear(), d.getMonth() + 1);
    await prisma.declaration.createMany({
      data: filed.map((f) => ({
        companyId: idByVkn.get(f.taxNumber)!,
        type: f.type,
        period: f.period,
        filedAt: f.filedAt,
        accrualAmount: f.accrualAmount,
        referenceNo: f.referenceNo,
        source: 'GIB' as const,
      })),
      skipDuplicates: true,
    });
  }

  // Demo e-tebligatlar: yılbaşından bugüne, birkaçı son günlerde ve incelenmemiş
  const senders = ['Kadıköy Vergi Dairesi Müdürlüğü', 'Beşiktaş Vergi Dairesi Müdürlüğü', 'Gelir İdaresi Başkanlığı', 'İstanbul Vergi Dairesi Başkanlığı'];
  const subjects = ['Vergi/Ceza İhbarnamesi', 'Ödeme Emri', 'Bilgi İsteme Yazısı', 'İzaha Davet Yazısı', 'Yoklama Fişi', 'Duyuru'];
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const span = now.getTime() - yearStart.getTime();
  const tebligats = [];
  for (let i = 0; i < 120; i++) {
    const c = all[(i * 7) % all.length];
    // Son 10 gün daha yoğun olsun ki "bu hafta / bugün" sayıları boş kalmasın
    const delivered = i < 14 ? new Date(now.getTime() - (i % 10) * 86_400_000 - 3_600_000) : new Date(yearStart.getTime() + ((i * 104729) % span));
    tebligats.push({
      companyId: c.id,
      documentNo: `DEMO-${delivered.getFullYear()}-${String(i).padStart(5, '0')}`,
      sender: senders[i % senders.length],
      subject: subjects[(i * 5) % subjects.length],
      deliveredAt: delivered,
      deemedServedAt: deemedServedDate(delivered),
      readAtGib: i % 3 === 0 ? null : new Date(delivered.getTime() + 86_400_000),
      reviewedAt: i < 14 ? null : new Date(delivered.getTime() + 2 * 86_400_000),
      source: 'DEMO' as const,
    });
  }
  await prisma.eTebligat.createMany({ data: tebligats });

  // e-Defter: şirketlerin hepsi, şahısların bir kısmı (seed'de i % 3 === 0 olanlar zaten şirket); her dördüncüsü geçici vergi dönemi bazında yüklüyor.
  // Son günü geçmiş dönemlerin çoğu yüklenmiş, birkaçı geç; son günü yaklaşanların bir kısmı yüklenmiş.
  const eDefterCompanies = all.filter((c, i) => c.type === 'SIRKET' || (c.type === 'SAHIS' && i % 3 === 1));
  const berats = [];
  for (const [i, c] of eDefterCompanies.entries()) {
    const preference = i % 4 === 3 ? ('QUARTERLY' as const) : ('MONTHLY' as const);
    await prisma.company.update({ where: { id: c.id }, data: { eDefterEnabled: true, eDefterPreference: preference } });
    for (let mo = 1; mo <= 9; mo++) {
      const period = periodForMonth(now.getFullYear(), mo, preference);
      if (!period) continue;
      const due = ruleDueDate(period, c.type);
      if (!due) continue;
      const roll = (i * 31 + mo * 17) % 100;
      const past = due < now;
      if ((past && roll >= 95) || (!past && roll >= 40)) continue; // yüklenmemiş
      const uploadedAt = new Date(due.getTime() - ((roll % 9) + 1) * 86_400_000);
      if (past && roll < 4) uploadedAt.setTime(due.getTime() + 3 * 86_400_000); // geç yüklenmiş
      if (uploadedAt > now) uploadedAt.setTime(now.getTime() - 86_400_000);
      berats.push({ companyId: c.id, period, uploadedAt });
    }
  }
  await prisma.eDefterBerat.createMany({ data: berats });

  const today = new Date();
  await prisma.taxCalendarEvent.createMany({
    data: [
      { title: 'Muhtasar ve Prim Hizmet Beyannamesi', dueDate: addDays(today, 1), appliesTo: [] },
      { title: 'Aylık KDV Beyannamesi', dueDate: addDays(today, 2), appliesTo: ['SIRKET', 'SAHIS'] },
      { title: 'Damga Vergisi Beyannamesi', dueDate: addDays(today, 3), appliesTo: ['SIRKET'] },
      { title: 'Geçici Vergi Beyannamesi', dueDate: addDays(today, 5), appliesTo: ['SIRKET', 'SAHIS'] },
      { title: 'e-Defter Berat Yükleme', dueDate: addDays(today, 6), appliesTo: ['SIRKET'] },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { tenantId: tenant.id, title: 'Sisteme hoş geldiniz', body: 'Demo veriler yüklendi.' },
      { tenantId: tenant.id, title: 'Vergi takvimi güncellendi', body: 'Bu haftanın son günleri eklendi.' },
    ],
  });

  console.log(`Seed tamam. Giriş: ${DEMO_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
