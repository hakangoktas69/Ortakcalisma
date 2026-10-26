// Satış kullanıcısı açma komutu (D27, D40): ilk satışçı buradan açılır; ekip ekranı (satis.ekip.invite) sonraki aşamadadır.
//   node apps/worker/src/satis-kullanici.ts --eposta ad.soyad@firma.com --ad "Ad Soyad"
// Geçici parola ekrana BİR KEZ yazılır; satışçı ilk girişte parolasını değiştirir ve iki adımlı doğrulamayı kurar.
// Kontrol düzlemine satış rolüyle (eworks_sales) bağlanır. Compose görevi: `node tools/deploy/yigin.mjs satis-kullanici …`.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool, loadConfig, salesSchema } from '@eworks/platform';
import { createSalesUser, NodeSalesCrypto, PgSalesUsers } from '@eworks/sales';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

export async function main(env = process.env) {
  const url = env['CONTROL_DATABASE_URL'];
  if (!url) throw new Error('CONTROL_DATABASE_URL gerekli');
  const eposta = arg('eposta');
  const ad = arg('ad');
  if (!eposta || !ad) throw new Error('Kullanım: satis-kullanici.ts --eposta a@b.c --ad "Ad Soyad"');
  const db = createPool(url, 1);
  try {
    const r = await createSalesUser(
      { email: eposta, fullName: ad },
      { users: new PgSalesUsers(db), crypto: new NodeSalesCrypto(loadConfig(salesSchema, env).SALES_TOTP_KEY), newId: randomUUID },
    );
    if (!r.ok) throw new Error(r.error === 'eposta_kullanimda' ? 'Bu e-postayla satış kullanıcısı zaten var' : 'E-posta ya da ad geçersiz');
    console.log(`✔ Satış kullanıcısı açıldı. Geçici parola (bir kez gösterilir): ${r.value.tempPassword}`);
    console.log('  İlk girişte parola değiştirilir ve iki adımlı doğrulama kurulur.');
  } finally {
    await db.end();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: Error) => {
    console.error(`✖ ${e.message}`);
    process.exit(1);
  });
}
