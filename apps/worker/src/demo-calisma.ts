// Demo verisi — çalışma alanı ve kurum hesapları: demo/geliştirme kipinde /gorevler, /notlar ve
// /firmalar/kurum_hesaplari ekranları boş kalmasın diye sentetik görev, not, kurum hesabı ve mükellef onayı üretir.
//
// Kurum şifreleri sahtedir ve gerçek hesap açmaz; yine de yalnız Vault'a gider (uygulama katmanı şifreyi tutmaz,
// döndürmez, günlüğe yazmaz) — demo veriyle de olsa kuralın dışına çıkılmaz. Üretim kipinde bu görev hiç çalışmaz.
//
// Görev ve notun doğal bir tekil anahtarı yoktur; tekrar çalıştırmada yinelenmesin diye önce mevcut kayıtlar okunur
// ve yalnız eksik olanlar yazılır.
import { CONSENT_METHODS, recordConsent, saveAccount, type ConsentRepository, type CredentialRepository, type Institution } from '@eworks/credentials';
import { changeStatus, createTask, listNotes, listTasks, addNote, type Can, type Ctx, type MemberPort, type NoteRepository, type TaskInput, type TaskRepository, type TaskStatus } from '@eworks/workspace';
import { VARSAYILAN_TOHUM, adTohumu, gunEkle, sec, tohumluRastgele } from './demo-rastgele.ts';

export type DemoFirma = { id: string; title: string };

/** Mali müşavir bürosunun gerçekten tuttuğu türden işler. */
const GOREV = [
  'KDV beyannamesini hazırla',
  'Muhtasar ve prim hizmet beyannamesini gönder',
  'Banka ekstresini mutabakata al',
  'Fatura eksiklerini mükelleften iste',
  'SGK işe giriş bildirgesini ver',
  'Geçici vergi hesaplamasını kontrol et',
  'Defter beyan kayıtlarını tamamla',
  'e-Tebligat kutusunu kontrol et',
] as const;

const NOT = [
  'Mükellef faturaları ayın ilk haftasında getiriyor.',
  'Banka ekstresi e-posta ile geliyor, dosyaya ekleniyor.',
  'Yeni şube açılışı için evraklar bekleniyor.',
  'Ortaklık yapısı değişti, sözleşme güncellenecek.',
  'Kasa farkı için mükellefle görüşüldü, düzeltme yapılacak.',
] as const;

const DURUMLAR: readonly TaskStatus[] = ['Bekliyor', 'Devam Ediyor', 'Öncelikli', 'Tamamlandı'];

export type DemoGorev = { girdi: TaskInput; durum: TaskStatus };

/**
 * Sentetik görevler. Durum ve son tarih bilinçli çeşitlendirilir: ana sayfadaki sayaçların (açık, öncelikli,
 * geciken, tamamlanan) hepsi dolu görünsün. İlk firma her zaman gecikmiş bir görev alır, böylece "geciken"
 * durumu şansa bağlı kalmaz.
 */
export function demoGorevleri(firmalar: readonly DemoFirma[], tohum: number = VARSAYILAN_TOHUM, bugun: Date = new Date()): DemoGorev[] {
  const cikti: DemoGorev[] = [];
  let sayac = 0;
  for (const [sira, firma] of firmalar.entries()) {
    const rnd = tohumluRastgele((tohum ^ adTohumu(`gorev:${firma.id}`)) >>> 0);
    const adet = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < adet; i++) {
      // Her dördüncü firmanın ilk görevi gecikmiş ve açık; kalanlar bugünden sonraya dağılır
      const gecikmis = i === 0 && sira % 4 === 0;
      const gun = gecikmis ? -(2 + Math.floor(rnd() * 20)) : Math.floor(rnd() * 25) - 2;
      // Durum sırayla dağıtılır (şansa bırakılmaz): dört durum da listede ve sayaçlarda görünsün
      const durum = gecikmis ? 'Öncelikli' : (DURUMLAR[sayac++ % DURUMLAR.length] as TaskStatus);
      cikti.push({ girdi: { title: sec(rnd, GOREV), firmId: firma.id, dueOn: gunEkle(bugun, gun), assigneeId: null }, durum });
    }
  }
  return cikti;
}

/** Bir firmanın sentetik notları (0–2 adet): her firmada not olmasına gerek yok. */
export function demoNotlari(firma: DemoFirma, tohum: number = VARSAYILAN_TOHUM): string[] {
  const rnd = tohumluRastgele((tohum ^ adTohumu(`not:${firma.id}`)) >>> 0);
  const adet = Math.floor(rnd() * 3);
  const secilen = new Set<string>();
  while (secilen.size < adet) secilen.add(sec(rnd, NOT));
  return [...secilen];
}

/** Görevleri açar; zaten duran görev (aynı başlık, firma ve son tarih) atlanır. */
export async function demoGorevleriAc(
  ctx: Ctx,
  firmalar: readonly DemoFirma[],
  can: Can,
  d: { tasks: TaskRepository; members: MemberPort },
  ayar: { tohum?: number; bugun?: Date } = {},
): Promise<{ eklenen: number; atlanan: number; hatalar: string[] }> {
  const anahtar = (t: { title: string; firmId: string | null; dueOn: string }) => `${t.title}|${t.firmId ?? ''}|${t.dueOn}`;
  const mevcut = new Set((await listTasks(ctx, d)).map(anahtar));
  let eklenen = 0;
  let atlanan = 0;
  const hatalar: string[] = [];
  for (const { girdi, durum } of demoGorevleri(firmalar, ayar.tohum ?? VARSAYILAN_TOHUM, ayar.bugun ?? new Date())) {
    if (mevcut.has(anahtar(girdi))) {
      atlanan++;
      continue;
    }
    const r = await createTask(ctx, girdi, can, d);
    if (!r.ok) {
      hatalar.push(r.error);
      continue;
    }
    mevcut.add(anahtar(girdi));
    eklenen++;
    // Görev 'Bekliyor' doğar; hedef durum farklıysa gerçek durum geçişiyle uygulanır (sürüm 1)
    if (durum !== 'Bekliyor') {
      const g = await changeStatus(ctx, r.value.id, 1, durum, can, d);
      if (!g.ok) hatalar.push(`durum:${g.error}`);
    }
  }
  return { eklenen, atlanan, hatalar };
}

/** Notları ekler; aynı firmada aynı gövde varsa atlanır. */
export async function demoNotlariAc(
  ctx: Ctx,
  firmalar: readonly DemoFirma[],
  d: { notes: NoteRepository },
  ayar: { tohum?: number } = {},
): Promise<{ eklenen: number; atlanan: number; hatalar: string[] }> {
  const mevcut = new Set((await listNotes(ctx, d)).map((n) => `${n.firmId}|${n.body}`));
  let eklenen = 0;
  let atlanan = 0;
  const hatalar: string[] = [];
  for (const firma of firmalar) {
    for (const govde of demoNotlari(firma, ayar.tohum ?? VARSAYILAN_TOHUM)) {
      if (mevcut.has(`${firma.id}|${govde}`)) {
        atlanan++;
        continue;
      }
      const r = await addNote(ctx, firma.id, govde, d);
      if (!r.ok) {
        hatalar.push(r.error);
        continue;
      }
      mevcut.add(`${firma.id}|${govde}`);
      eklenen++;
    }
  }
  return { eklenen, atlanan, hatalar };
}

/** Sahte ama biçimi geçerli kurum bilgileri. Gerçek bir hesaba karşılık gelmez; sahte GİB dışında hiçbir yerde işe yaramaz. */
const sahteAlanlar = (kurum: Institution, rnd: () => number): Record<string, string> => {
  const sifre = `demo-${Math.floor(rnd() * 1e9)}`;
  if (kurum === 'GIB') return { username: `demo${Math.floor(rnd() * 1e7)}`, password: sifre };
  if (kurum === 'UETS') return { address: `demo-uets-${Math.floor(rnd() * 1e6)}`, password: sifre };
  return { username: String(10000000000 + Math.floor(rnd() * 8e10)).slice(0, 11), workplaceCode: '0001', systemPassword: sifre, workplacePassword: `${sifre}-isyeri` };
};

/**
 * Firma kurum hesaplarını (GİB, SGK, UETS) ve mükellef onayını (D46) açar. Onay bilerek firmaların bir kısmına
 * verilir: ekranda hem "onaylı" hem "onay bekliyor" durumu görünsün ve onaysız firmada işin açılmadığı denenebilsin.
 * `can` demo müşavirin yetkisini temsil eder (işçide oturum yetki ağacı yoktur).
 */
export async function demoKurumHesaplariniAc(
  ctx: Ctx,
  firmalar: readonly DemoFirma[],
  can: Can,
  d: { credentials: CredentialRepository; consents: ConsentRepository },
  ayar: { tohum?: number; bugun?: Date; musavirId?: string } = {},
): Promise<{ hesap: number; onay: number; hatalar: string[] }> {
  const tohum = ayar.tohum ?? VARSAYILAN_TOHUM;
  const bugun = ayar.bugun ?? new Date();
  const bugunGun = bugun.toISOString().slice(0, 10);
  let hesap = 0;
  let onay = 0;
  const hatalar: string[] = [];

  // Müşavirin kendi GİB hesabı: e-Beyanname sözleşme listesi bununla okunur, ekranda ayrı bir kart olarak görünür
  if (ayar.musavirId) {
    const rnd = tohumluRastgele((tohum ^ adTohumu(`musavir:${ayar.musavirId}`)) >>> 0);
    const r = await saveAccount(ctx, { ownerKind: 'advisor', ownerId: ayar.musavirId, institution: 'GIB', fields: sahteAlanlar('GIB', rnd) }, d.credentials);
    if (r.ok) hesap++;
    else hatalar.push(`musavir_GIB:${r.error}`);
  }
  for (const [sira, firma] of firmalar.entries()) {
    const rnd = tohumluRastgele((tohum ^ adTohumu(`kurum:${firma.id}`)) >>> 0);
    // Her firmada GİB; üçte birinde ayrıca SGK işyeri, dörtte birinde UETS
    const kurumlar: { kurum: Institution; label?: string }[] = [{ kurum: 'GIB' }];
    if (sira % 3 === 0) kurumlar.push({ kurum: 'SGK', label: 'Merkez' });
    if (sira % 4 === 1) kurumlar.push({ kurum: 'UETS' });
    for (const { kurum, label } of kurumlar) {
      const r = await saveAccount(
        ctx,
        { ownerKind: 'firm', ownerId: firma.id, institution: kurum, ...(label ? { label } : {}), fields: sahteAlanlar(kurum, rnd) },
        d.credentials,
      );
      if (r.ok) hesap++;
      else hatalar.push(`${kurum}:${r.error}`);
    }
    // Dört firmadan üçünde onay var; kalanlar "onay bekliyor" olarak kalır
    if (sira % 4 === 3) continue;
    const o = await recordConsent(
      ctx,
      { firmId: firma.id, method: sec(rnd, CONSENT_METHODS).id, consentedOn: gunEkle(bugun, -(1 + Math.floor(rnd() * 400))), attested: true },
      can,
      d.consents,
      bugunGun,
    );
    if (o.ok) onay++;
    else hatalar.push(`onay:${o.error}`);
  }
  return { hesap, onay, hatalar };
}
