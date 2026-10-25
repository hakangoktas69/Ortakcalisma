// Hesap açma komutu (satış portalı ekranı yapılana kadar; D27). Compose görev profili: `hesap-ac`.
//   node apps/worker/src/hesap-ac.ts ofis  --ofis "Ofis adı" --eposta a@b.c --ad "Ad Soyad"     (parola: HESAP_SIFRE ortamı)
//   node apps/worker/src/hesap-ac.ts uye   --ofis-id <uuid> --eposta a@b.c --ad "Ad" --rol personel
//   node apps/worker/src/hesap-ac.ts demo  (DEMO_OFIS, DEMO_EPOSTA, DEMO_SIFRE, DEMO_AD ortamından; tekrar çalıştırılabilir)
// Parola komut satırında verilmez (süreç listesinde ve kabuk geçmişinde görünür); ortamdan okunur.
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoTrueAuthProvider } from '@eworks/identity-access';
import { databaseSchema, loadConfig, ShardRouter } from '@eworks/platform';
import { addMember, openOffice, PgDirectory, PgTenantProvisioner, type MemberRole } from '@eworks/sales';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const need = (v: string | undefined, ad: string) => {
  if (!v) throw new Error(`${ad} gerekli`);
  return v;
};

export async function main(env = process.env) {
  const db = loadConfig(databaseSchema, env);
  const router = ShardRouter.fromUrls(db.CONTROL_DATABASE_URL, db.SHARD_DATABASE_URLS);
  const auth = new GoTrueAuthProvider(need(env['AUTH_URL'], 'AUTH_URL'), need(env['JWT_SECRET'], 'JWT_SECRET'));
  const deps = { identity: auth, directory: new PgDirectory(router), tenant: new PgTenantProvisioner(router), newId: randomUUID };
  try {
    const komut = process.argv[2];
    if (komut === 'ofis' || komut === 'demo') {
      const demo = komut === 'demo';
      const r = await openOffice(
        {
          officeName: need(demo ? env['DEMO_OFIS'] : arg('ofis'), 'ofis adı'),
          admin: {
            email: need(demo ? env['DEMO_EPOSTA'] : arg('eposta'), 'e-posta'),
            password: need(demo ? env['DEMO_SIFRE'] : env['HESAP_SIFRE'], 'parola (ortam)'),
            name: need(demo ? env['DEMO_AD'] : arg('ad'), 'ad'),
          },
        },
        deps,
      );
      if (!r.ok) throw new Error(r.error === 'gecersiz_bilgi' ? 'Bilgiler geçersiz (parola en az 12 karakter)' : 'Kullanıcı var, parola farklı');
      console.log(`✔ Ofis hazır: ${r.value.orgId}`);
    } else if (komut === 'uye') {
      const rol = need(arg('rol'), '--rol') as MemberRole;
      const r = await addMember(
        { orgId: need(arg('ofis-id'), '--ofis-id'), role: rol, user: { email: need(arg('eposta'), '--eposta'), password: need(env['HESAP_SIFRE'], 'HESAP_SIFRE'), name: need(arg('ad'), '--ad') } },
        deps,
      );
      if (!r.ok) throw new Error(r.error);
      console.log(`✔ Kullanıcı ofiste: ${rol}`);
    } else {
      throw new Error('Kullanım: hesap-ac.ts ofis|uye|demo');
    }
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
