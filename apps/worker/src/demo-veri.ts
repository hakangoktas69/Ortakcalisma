// Demo verisi: demo/geliştirme kipinde portalın boş ekran göstermemesi için sentetik veri açar.
// Compose görev profili: `demo-veri`; `yigin.mjs` yalnız demo profilinde çağırır (üretimde profil her zaman `uretim`).
//   node apps/worker/src/demo-veri.ts            (DEMO_OFIS, DEMO_EPOSTA, DEMO_SIFRE ortamından; tekrar çalıştırılabilir)
//
// Dilimler: bu dosya mükellef kartlarını açar ve sırayla diğer dilimleri çağırır (`demo-tebligat.ts` …).
// Paylaşılan üreteçler `demo-rastgele.ts`'de.
//
// Veri gerçek değildir: unvan ve kişi adları küçük sözcük listelerinden üretilir, kimlikler sahte ama kontrol hanesi
// geçerlidir (TCKN 99 ile başlar). Gerçek mükellef/kişi verisi hiçbir koşulda buraya girmez (kurallar §8).
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PgConsentRepository, PgCredentialRepository } from '@eworks/credentials';
import { PgDocumentRepository } from '@eworks/documents';
import { GoTrueAuthProvider, PgMembershipReader } from '@eworks/identity-access';
import { PgNoticeRepository } from '@eworks/notices';
import { databaseSchema, Depo, loadConfig, ShardRouter, storageSchema } from '@eworks/platform';
import { createFirm, listFirms, myAdvisorId, PgFirmRepository, PgTaxpayerRegistry, taxIdHasher, type Ctx, type FirmDeps, type FirmInput } from '@eworks/portfolio';
import { PgDirectory } from '@eworks/sales';
import { PgFilingRepository } from '@eworks/social-security';
import { PgContractRepository, PgDeclarationRepository } from '@eworks/tax-filing';
import { PgNoteRepository, PgTaskRepository } from '@eworks/workspace';
import { demoBeyannameleriAc } from './demo-beyanname.ts';
import { demoGorevleriAc, demoKurumHesaplariniAc, demoNotlariAc, SAHTE_GIB_SIFRE } from './demo-calisma.ts';
import { VARSAYILAN_TOHUM, adTohumu, sahteTckn, sahteVkn, sec, tohumluRastgele } from './demo-rastgele.ts';
import { demoTebligatlariniAc } from './demo-tebligat.ts';
import { belgePortu, firmaPortu } from './uygulayici.ts';

const VARSAYILAN_ADET = 12;

// Üretilen unvanlar için sözcük listeleri — gerçek bir firmayı anlatmaz.
const ONEK = ['Çınar', 'Deniz', 'Ege', 'Kuzey', 'Lale', 'Marmara', 'Nar', 'Özgür', 'Pusula', 'Safir', 'Toros', 'Ufuk', 'Yıldız', 'Zeytin'] as const;
const SEKTOR = ['Tekstil', 'Gıda', 'Lojistik', 'Yazılım', 'İnşaat', 'Mobilya', 'Enerji', 'Turizm', 'Makine', 'Tarım'] as const;
const AD = ['Ayşe', 'Burak', 'Ceren', 'Deniz', 'Elif', 'Furkan', 'Gamze', 'Hakan', 'İrem', 'Kerem', 'Merve', 'Onur'] as const;
const SOYAD = ['Aydın', 'Bulut', 'Çelik', 'Demir', 'Erdem', 'Güneş', 'Kaya', 'Korkmaz', 'Şahin', 'Tunç', 'Yalçın'] as const;
const SEHIR = ['Samsun', 'Ankara', 'İstanbul', 'İzmir', 'Bursa', 'Trabzon', 'Adana'] as const;
const VD = ['Gazi', 'Çankaya', 'İlkadım', 'Karşıyaka', 'Osmangazi', 'Hürriyet', 'Seyhan'] as const;
const FAALIYET = [
  ['620100', 'Bilgisayar programlama faaliyetleri'],
  ['141910', 'Hazır giyim imalatı'],
  ['494100', 'Karayolu ile yük taşımacılığı'],
  ['107100', 'Ekmek ve taze pastane ürünleri imalatı'],
  ['412002', 'İkamet amaçlı binaların inşaatı'],
  ['310900', 'Diğer mobilyaların imalatı'],
] as const;

/** Şirket türleri VKN, şahıs/esnaf/serbest meslek TCKN alır (kimlik türü tutarlı olsun). */
const SAHIS_TURLERI = ['Şahıs', 'Esnaf', 'Serbest Meslek'] as const;
const SIRKET_TURLERI = ['Limited', 'Anonim'] as const;

const UNVAN_SONU: Record<string, string> = { Limited: 'Ltd. Şti.', Anonim: 'A.Ş.' };

/**
 * Demo mükellef kartları. Aynı tohum ve adetle her zaman aynı listeyi verir; ekranların dolu görünmesi için
 * tür, durum ve vergi usulü çeşitlendirilir (süzgeçler ve sayaçlar anlamlı olsun).
 */
export function demoFirmalari(tohum: number = VARSAYILAN_TOHUM, adet: number = VARSAYILAN_ADET): FirmInput[] {
  const rnd = tohumluRastgele(tohum);
  const kullanilan = new Set<string>();
  const cikti: FirmInput[] = [];
  for (let i = 0; i < adet; i++) {
    // İlk üçte ikisi şirket, kalanı şahıs: listede ikisi de görünsün
    const sirket = i % 3 !== 2;
    const kind = sirket ? sec(rnd, SIRKET_TURLERI) : sec(rnd, SAHIS_TURLERI);
    let taxId = sirket ? sahteVkn(rnd) : sahteTckn(rnd);
    while (kullanilan.has(taxId)) taxId = sirket ? sahteVkn(rnd) : sahteTckn(rnd);
    kullanilan.add(taxId);

    const [kod, adi] = sec(rnd, FAALIYET);
    const unvan = sirket ? `${sec(rnd, ONEK)} ${sec(rnd, SEKTOR)} ${UNVAN_SONU[kind] ?? ''}`.trim() : `${sec(rnd, AD)} ${sec(rnd, SOYAD)}`;
    const kart: FirmInput = {
      title: unvan,
      kind,
      taxId,
      taxOffice: `${sec(rnd, VD)} Vergi Dairesi`,
      city: sec(rnd, SEHIR),
      representative: `${sec(rnd, AD)} ${sec(rnd, SOYAD)}`,
      // Rehberlerde ayrılmış sahte numara aralığı ve test alan adı: gerçek kimseye ulaşmaz
      phone: `0555 000 00 ${String(i + 10).padStart(2, '0')}`,
      email: `demo${i + 1}@ornek.test`,
      activityCode: kod,
      activityName: adi,
      taxRegime: kind === 'Esnaf' ? 'Basit Usul' : 'Gerçek Usul',
      // Çoğu aktif; birkaçı onay bekleyen ve pasif olsun ki süzgeçler ve "onay bekleyen" sayacı dolu görünsün
      status: i % 5 === 3 ? 'Onay Bekliyor' : i % 7 === 6 ? 'Pasif' : 'Aktif',
    };
    // Bir kısmı gruplu olsun (grup süzgeci dolu görünsün); isteğe bağlı alan yalnız değeri varken eklenir
    cikti.push(i % 4 === 0 ? { ...kart, groupName: 'Demo Portföy' } : kart);
  }
  return cikti;
}

/**
 * Demo mükelleflerini ofise ekler. Tekrar çalıştırılabilir: zaten kayıtlı VKN/TCKN beklenen durumdur ve
 * `atlanan` sayılır. Başka her hata (`musavir_yok`, `gecersiz`, `catisma`) `hatalar`a yazılır — sessizce
 * "zaten vardı" sayılırsa kurulum hatası başarı gibi görünür ve ekranlar boş açılır.
 */
export async function demoFirmalariniAc(
  ctx: Ctx,
  d: FirmDeps,
  ayar: { adet?: number; tohum?: number } = {},
): Promise<{ eklenen: number; atlanan: number; hatalar: string[] }> {
  let eklenen = 0;
  let atlanan = 0;
  const hatalar: string[] = [];
  for (const firma of demoFirmalari(ayar.tohum ?? VARSAYILAN_TOHUM, ayar.adet ?? VARSAYILAN_ADET)) {
    const r = await createFirm(ctx, firma, d);
    if (r.ok) eklenen++;
    else if (r.error === 'vkn_kayitli') atlanan++;
    else hatalar.push(r.error);
  }
  return { eklenen, atlanan, hatalar };
}

const need = (v: string | undefined, ad: string) => {
  if (!v) throw new Error(`${ad} gerekli`);
  return v;
};

/** Sessiz başarısızlık olmaz: yığın "ayakta" derken ekranların boş kalması bu işin önlemek için yazıldığı durumdur. */
const hatasizOlmali = (dilim: string, hatalar: readonly string[]) => {
  if (hatalar.length > 0) throw new Error(`${dilim} eksik: ${hatalar.length} kayıt açılamadı (${[...new Set(hatalar)].join(', ')})`);
};

export async function main(env = process.env) {
  // Sahte veri yalnız demo kipinde üretilir; gelistirme, debug ve uretim kiplerinde veri gerçektir.
  // Denetim veritabanına dokunmadan, en başta yapılır (görev elle de çalıştırılabilir).
  const kip = env['YIGIN_KIPI'] ?? 'demo';
  if (kip !== 'demo') throw new Error(`Sahte veri yalnız demo kipinde üretilir; bu yığın ${kip} kipinde.`);
  const db = loadConfig(databaseSchema, env);
  const st = loadConfig(storageSchema, env);
  const router = ShardRouter.fromUrls(db.CONTROL_DATABASE_URL, db.SHARD_DATABASE_URLS);
  // Belgeler demo S3'e yazılır; kova yoksa açılır (işçiyle aynı depo)
  const depo = new Depo({ endpoint: st.S3_ENDPOINT, bucket: st.S3_BUCKET, accessKey: st.S3_ACCESS_KEY, secretKey: st.S3_SECRET_KEY, region: st.S3_REGION });
  await depo.hazirla();
  try {
    const auth = new GoTrueAuthProvider(need(env['AUTH_URL'], 'AUTH_URL'), need(env['JWT_SECRET'], 'JWT_SECRET'));
    const ofisAdi = need(env['DEMO_OFIS'], 'DEMO_OFIS');
    const ofis = await new PgDirectory(router).organizationByName(ofisAdi);
    if (!ofis) throw new Error(`Demo ofisi bulunamadı: ${ofisAdi}`);

    // Portalın kullandığı yoldan yazılır: demo kullanıcısının oturumuyla, böylece alan kuralları ve RLS aynen işler.
    const oturum = await auth.signIn(need(env['DEMO_EPOSTA'], 'DEMO_EPOSTA'), need(env['DEMO_SIFRE'], 'DEMO_SIFRE'));
    if (!oturum) throw new Error('Demo kullanıcısıyla giriş yapılamadı');
    const kullanici = await auth.verify(oturum.accessToken);
    if (!kullanici) throw new Error('Demo oturumu doğrulanamadı');

    const tohum = adTohumu(ofisAdi);
    const ctx: Ctx = { sub: kullanici.id, org: ofis.id };
    const firmaDeps: FirmDeps = {
      repo: new PgFirmRepository(router),
      registry: new PgTaxpayerRegistry(router),
      hashTaxId: taxIdHasher(need(env['TAX_ID_HMAC_KEY'], 'TAX_ID_HMAC_KEY')),
      newId: randomUUID,
    };

    const firmalar = await demoFirmalariniAc(ctx, firmaDeps, { tohum });
    console.log(`✔ Demo verisi: ${firmalar.eklenen} mükellef eklendi, ${firmalar.atlanan} zaten vardı`);
    hatasizOlmali('Demo verisi', firmalar.hatalar);

    // Kurumdan gelen kayıtları (e-Tebligat, beyanname, SGK) yalnız işçi yazar (RLS app.is_system):
    // bu yüzden bundan sonrası sistem bağlamıdır (`sub` yok).
    const sistem: Ctx = { org: ofis.id };
    const kayitli = (await listFirms(ctx, {}, { repo: firmaDeps.repo })).map((f) => ({ id: f.id, taxId: f.taxId, title: f.title, taxOffice: f.taxOffice }));

    const tebligat = await demoTebligatlariniAc(sistem, kayitli, new PgNoticeRepository(router), { tohum });
    console.log(`✔ Demo e-Tebligat: ${tebligat.eklenen} kayıt eklendi, ${tebligat.guncellenen} güncellendi`);
    hatasizOlmali('Demo e-Tebligat', tebligat.hatalar);

    const musavir = await myAdvisorId(ctx, { repo: firmaDeps.repo });
    if (!musavir) throw new Error('Demo ofisinde müşavir kaydı yok');
    const beyanname = await demoBeyannameleriAc(
      sistem,
      kayitli,
      {
        firms: firmaPortu(firmaDeps),
        contracts: new PgContractRepository(router),
        declarations: new PgDeclarationRepository(router),
        filings: new PgFilingRepository(router),
        documents: belgePortu(new PgDocumentRepository(router)),
      },
      { advisorId: musavir, tohum, belgeDepo: depo },
    );
    console.log(
      `✔ Demo beyanname: ${beyanname.sozlesme} sözleşme · ${beyanname.beyanname} beyanname (${beyanname.yeni} yeni) · ${beyanname.sgk} SGK bildirimi · ${beyanname.belge} belge`,
    );
    hatasizOlmali('Demo beyanname', beyanname.hatalar);

    // Görev, not ve kurum hesabı kullanıcı bağlamında yazılır (RLS kapsamı kullanıcıya bağlı).
    // `can`: demo müşavirin yetkisini temsil eder — işçide oturumun yetki ağacı yoktur.
    const yetkili = () => true;
    const uyeler = new PgMembershipReader(router);
    // workspace bağlamı oturum sahibini zorunlu ister (görev/not kullanıcıya bağlıdır)
    const kullaniciCtx = { sub: kullanici.id, org: ofis.id };
    const gorevler = await demoGorevleriAc(
      kullaniciCtx,
      kayitli,
      yetkili,
      { tasks: new PgTaskRepository(router), members: { isStaff: async (c, id) => (await uyeler.staff(c.org, c.sub)).some((m) => m.userId === id) } },
      { tohum },
    );
    console.log(`✔ Demo görev: ${gorevler.eklenen} eklendi, ${gorevler.atlanan} zaten vardı`);
    hatasizOlmali('Demo görev', gorevler.hatalar);

    const notlar = await demoNotlariAc(kullaniciCtx, kayitli, { notes: new PgNoteRepository(router) }, { tohum });
    console.log(`✔ Demo not: ${notlar.eklenen} eklendi, ${notlar.atlanan} zaten vardı`);
    hatasizOlmali('Demo not', notlar.hatalar);

    const kurum = await demoKurumHesaplariniAc(kullaniciCtx, kayitli, yetkili, { credentials: new PgCredentialRepository(router), consents: new PgConsentRepository(router) },
      // Sahte GİB'in beklediği şifre: demo kipinde "GİB'den güncelle" düğmesi gerçekten çalışsın
      { tohum, musavirId: musavir, gibSifre: env['SAHTE_GIB_SIFRE'] ?? SAHTE_GIB_SIFRE },
    );
    console.log(`✔ Demo kurum hesabı: ${kurum.hesap} hesap · ${kurum.onay} mükellef onayı`);
    hatasizOlmali('Demo kurum hesabı', kurum.hatalar);
  } finally {
    await router.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: Error) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
}
