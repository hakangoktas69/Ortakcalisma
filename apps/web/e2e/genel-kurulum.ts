// Kabul testleri için kullanıcılar: her koşuda yeni bir ofis (yönetici + personel) gerçek hesap açma use-case'iyle açılır.
// Kimlik bilgileri geçici dosyaya yazılır (test-results altında, git'e girmez).
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { ShardRouter } from '@eworks/platform';
import { addMember, openOffice, PgDirectory, PgTenantProvisioner } from '@eworks/sales';
import { yigin } from '@eworks/testing';

export const KULLANICILAR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'test-results', 'e2e-kullanicilar.json');

export type E2eKullanicilar = {
  ofisAdi: string;
  orgId: string;
  yonetici: { eposta: string; parola: string; ad: string };
  personel: { eposta: string; parola: string; ad: string };
};

/** Yeni ofis + yönetici (+ istenirse personel). Kurum işi gibi paylaşılan durumu değiştiren testler kendi ofisini açar. */
export async function ofisAc(personelle = false): Promise<E2eKullanicilar> {
  const router = ShardRouter.fromUrls(yigin.controlUrl(), yigin.shardUrls('eworks_worker'));
  const deps = { identity: new GoTrueAuthProvider(yigin.authUrl(), yigin.jwtSecret()), directory: new PgDirectory(router), tenant: new PgTenantProvisioner(router), newId: randomUUID };
  try {
    const ek = randomUUID().slice(0, 8);
    const yonetici = { eposta: `yonetici-${ek}@eworks.test`, parola: `Yonetici-${randomUUID()}`, ad: 'Ayşe Müşavir' };
    const personel = { eposta: `personel-${ek}@eworks.test`, parola: `Personel-${randomUUID()}`, ad: 'Mehmet Personel' };
    const ofisAdi = `Kabul Testi Ofisi ${ek}`;
    const o = await openOffice({ officeName: ofisAdi, admin: { email: yonetici.eposta, password: yonetici.parola, name: yonetici.ad } }, deps);
    if (!o.ok) throw new Error(`ofis açılamadı: ${o.error}`);
    if (personelle) {
      const p = await addMember({ orgId: o.value.orgId, role: 'personel', user: { email: personel.eposta, password: personel.parola, name: personel.ad } }, deps);
      if (!p.ok) throw new Error(`personel açılamadı: ${p.error}`);
    }
    return { ofisAdi, orgId: o.value.orgId, yonetici, personel };
  } finally {
    await router.end();
  }
}

export default async function genelKurulum() {
  const veri = await ofisAc(true);
  mkdirSync(dirname(KULLANICILAR), { recursive: true });
  writeFileSync(KULLANICILAR, JSON.stringify(veri));
}
