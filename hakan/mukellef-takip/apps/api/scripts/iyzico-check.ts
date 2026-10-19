/**
 * iyzico anahtar ve bağlantı kontrolü. Anahtarları ekrana yazmaz.
 *
 *   npm run iyzico:check            → imzalı BIN sorgusu (ödeme oluşturmaz)
 *   npm run iyzico:check -- --cf    → ek olarak SANDBOX'ta ödeme formu oturumu açar (para çekilmez),
 *                                     geri dönüş adresinin (API_PUBLIC_URL) kabul edilip edilmediğini gösterir
 */
import 'dotenv/config';
import { IyzicoClient, IyzicoError, iyzicoPrice } from '../src/billing/iyzico.client.js';

async function main(): Promise<number> {
  const client = new IyzicoClient();
  const { baseUrl, apiKey, secretKey } = client.config;
  const mask = (s: string) => (s ? `var (${s.length} karakter${s.startsWith('sandbox-') ? ', sandbox-' : ''})` : 'YOK');

  console.log(`Sağlayıcı (BILLING_PROVIDER): ${process.env.BILLING_PROVIDER ?? 'demo'}`);
  console.log(`Adres: ${baseUrl} ${client.isSandbox ? '(SANDBOX — gerçek para çekilmez)' : '(CANLI!)'}`);
  console.log(`API anahtarı: ${mask(apiKey)}   Gizli anahtar: ${secretKey ? `var (${secretKey.length} karakter)` : 'YOK'}`);
  if (!client.configured) {
    console.log('\n✗ IYZICO_API_KEY ve IYZICO_SECRET_KEY apps/api/.env içinde tanımlı değil.');
    return 1;
  }
  if (/\s/.test(apiKey + secretKey)) console.log('! Anahtarlarda boşluk var; kopyalarken fazladan karakter gelmiş olabilir.');
  if (apiKey.startsWith('sandbox-') !== client.isSandbox)
    console.log('! Anahtar türü ile adres uyuşmuyor olabilir (sandbox anahtarları genelde "sandbox-" ile başlar).');

  try {
    const r = await client.ping();
    if (r.status === 'success') console.log(`\n✓ Kimlik doğrulama başarılı (BIN sorgusu: ${r.bankName ?? '?'} / ${r.cardAssociation ?? '?'})`);
    else {
      console.log(`\n✗ iyzico isteği reddetti: [${r.errorCode}] ${r.errorMessage}`);
      return 1;
    }
  } catch (e) {
    console.log(`\n✗ Bağlantı hatası: ${(e as Error).message}`);
    return 1;
  }

  if (process.argv.includes('--cf')) {
    if (!client.isSandbox) {
      console.log('\n--cf sadece sandbox adresinde çalıştırılır.');
      return 1;
    }
    const callbackUrl = `${(process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '')}/billing/iyzico/callback`;
    const price = iyzicoPrice(1);
    try {
      const r = await client.initialize({
        locale: 'tr',
        conversationId: 'baglanti-testi',
        price,
        paidPrice: price,
        currency: 'TRY',
        basketId: 'baglanti-testi',
        paymentGroup: 'SUBSCRIPTION',
        callbackUrl,
        enabledInstallments: [1],
        buyer: {
          id: 'test',
          name: 'Test',
          surname: 'Kullanici',
          identityNumber: '11111111111',
          email: 'test@example.com',
          gsmNumber: '+905000000000',
          registrationAddress: 'Test adresi',
          city: 'Istanbul',
          country: 'Turkey',
        },
        billingAddress: { contactName: 'Test Kullanici', city: 'Istanbul', country: 'Turkey', address: 'Test adresi' },
        basketItems: [{ id: 'test', name: 'Baglanti testi', category1: 'Abonelik', itemType: 'VIRTUAL', price }],
      });
      console.log(`✓ Sandbox ödeme formu açıldı; geri dönüş adresi kabul edildi: ${callbackUrl}`);
      console.log(`  (Oturum kullanılmadan bırakıldı; ödeme yapılmadı. Sayfa: ${new URL(r.paymentPageUrl).host})`);
    } catch (e) {
      const err = e as IyzicoError;
      console.log(`✗ Ödeme formu açılamadı: ${err.message}${err.errorCode ? ` [${err.errorCode}]` : ''}`);
      console.log(`  Geri dönüş adresi: ${callbackUrl}`);
      console.log('  Hata geri dönüş adresiyle ilgiliyse https bir tünel adresi (API_PUBLIC_URL) gerekebilir.');
      return 1;
    }
  }
  return 0;
}

// process.exit yerine exitCode: Windows'ta açık bağlantı varken process.exit Node'u çökertebiliyor
process.exitCode = await main();
