import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'node:crypto';
import { roundKurus } from '../../../shared-kernel/money.js';

// iyzico Ödeme Formu (Checkout Form) istemcisi.
//
// Kaynaklar (docs.iyzico.com):
//  - HMACSHA256 kimlik doğrulama: Authorization: IYZWSv2 base64("apiKey:"+apiKey+"&randomKey:"+rnd+"&signature:"+hex)
//    signature = HMACSHA256(randomKey + uriPath + body, secretKey) — hex
//  - CF initialize: POST /payment/iyzipos/checkoutform/initialize/auth/ecom
//  - CF retrieve:   POST /payment/iyzipos/checkoutform/auth/ecom/detail
//
// Kart bilgileri iyzico'nun sayfasında girilir; bu sunucuya hiç gelmez.

export const CF_INITIALIZE_PATH = '/payment/iyzipos/checkoutform/initialize/auth/ecom';
export const CF_RETRIEVE_PATH = '/payment/iyzipos/checkoutform/auth/ecom/detail';
export const BIN_CHECK_PATH = '/payment/bin/check';

export class IyzicoError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
  ) {
    super(message);
  }
}

/** IYZWSv2 Authorization başlığı. İmzalanan gövde, gönderilen gövdenin birebir aynısı olmalıdır. */
export function iyzicoAuthHeader(apiKey: string, secretKey: string, randomKey: string, uriPath: string, body: string): string {
  const signature = createHmac('sha256', secretKey).update(randomKey + uriPath + body).digest('hex');
  const raw = `apiKey:${apiKey}&randomKey:${randomKey}&signature:${signature}`;
  return `IYZWSv2 ${Buffer.from(raw, 'utf8').toString('base64')}`;
}

/** iyzico tutarları ondalık metin bekler; kuruş hassasiyetinde, gereksiz sıfırsız ("15300.0" değil "15300"). */
export function iyzicoPrice(amount: number): string {
  return roundKurus(amount).toFixed(2).replace(/\.?0+$/, '');
}

export interface CfRetrieveResult {
  status?: string; // success | failure (isteğin kendisi)
  paymentStatus?: string; // SUCCESS | FAILURE | INIT_THREEDS | CALLBACK_THREEDS
  fraudStatus?: number; // 1 onaylı, 0 incelemede, -1 reddedildi
  paidPrice?: number | string;
  price?: number | string;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  paymentId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export type PaymentVerdict =
  | { outcome: 'PAID'; paymentId: string; fraudStatus: number }
  | { outcome: 'REVIEW'; paymentId?: string; fraudStatus: number; reason: string }
  | { outcome: 'FAILED'; reason: string; fraudStatus?: number };

/**
 * iyzico'nun sorgu sonucuna göre ödemenin durumunu belirler. Tarayıcıdan gelen bilgiye değil, sunucunun
 * iyzico'ya sorduğu sonuca bakılır. Ödeme ancak şunların HEPSİ tutarsa onaylanır:
 * istek başarılı, ödeme SUCCESS, dolandırıcılık kontrolü onaylı (1), sepet/konuşma numarası bizim kaydımız,
 * tahsil edilen tutar ve para birimi bizim hesapladığımızla aynı.
 */
export function verdictFromRetrieve(r: CfRetrieveResult, expected: { paymentId: string; amount: number; currency: string }): PaymentVerdict {
  if (r.status !== 'success') return { outcome: 'FAILED', reason: `iyzico sorgusu başarısız: ${r.errorMessage ?? r.errorCode ?? 'bilinmeyen hata'}` };
  if (r.basketId !== expected.paymentId || r.conversationId !== expected.paymentId) {
    return { outcome: 'FAILED', reason: 'Sepet / işlem numarası bu ödemeyle eşleşmiyor' };
  }
  if (r.paymentStatus !== 'SUCCESS') return { outcome: 'FAILED', reason: `Ödeme tamamlanmadı (${r.paymentStatus ?? 'durum yok'})`, fraudStatus: r.fraudStatus };
  const paid = Number(r.paidPrice);
  if (!Number.isFinite(paid) || roundKurus(paid) !== roundKurus(expected.amount)) {
    return { outcome: 'FAILED', reason: `Tahsil edilen tutar (${r.paidPrice}) beklenen tutarla (${expected.amount}) aynı değil`, fraudStatus: r.fraudStatus };
  }
  if (r.currency && r.currency !== expected.currency) return { outcome: 'FAILED', reason: `Para birimi uyuşmuyor (${r.currency})` };
  if (r.fraudStatus === -1) return { outcome: 'FAILED', reason: 'iyzico dolandırıcılık kontrolü ödemeyi reddetti', fraudStatus: -1 };
  if (r.fraudStatus !== 1) {
    return { outcome: 'REVIEW', paymentId: r.paymentId, fraudStatus: r.fraudStatus ?? 0, reason: 'Ödeme iyzico tarafından inceleniyor' };
  }
  if (!r.paymentId) return { outcome: 'FAILED', reason: 'iyzico ödeme numarası dönmedi' };
  return { outcome: 'PAID', paymentId: r.paymentId, fraudStatus: 1 };
}

export interface CfInitializeRequest {
  locale: 'tr';
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: 'TRY';
  basketId: string;
  paymentGroup: 'SUBSCRIPTION' | 'PRODUCT';
  callbackUrl: string;
  enabledInstallments: number[];
  buyer: {
    id: string;
    name: string;
    surname: string;
    identityNumber: string;
    email: string;
    gsmNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    ip?: string;
  };
  billingAddress: { contactName: string; city: string; country: string; address: string };
  basketItems: { id: string; name: string; category1: string; itemType: 'VIRTUAL'; price: string }[];
}

@Injectable()
export class IyzicoClient {
  private readonly logger = new Logger(IyzicoClient.name);

  get config() {
    return {
      apiKey: process.env.IYZICO_API_KEY ?? '',
      secretKey: process.env.IYZICO_SECRET_KEY ?? '',
      // Varsayılan sandbox: gerçek kartlardan para çekilmez
      baseUrl: (process.env.IYZICO_BASE_URL ?? 'https://sandbox-api.iyzipay.com').replace(/\/+$/, ''),
    };
  }

  get configured() {
    const c = this.config;
    return !!(c.apiKey && c.secretKey);
  }

  get isSandbox() {
    return this.config.baseUrl.includes('sandbox');
  }

  private async post<T>(path: string, payload: object): Promise<T> {
    const { apiKey, secretKey, baseUrl } = this.config;
    if (!apiKey || !secretKey) throw new IyzicoError('iyzico API anahtarları tanımlı değil (IYZICO_API_KEY, IYZICO_SECRET_KEY)');
    const body = JSON.stringify(payload);
    const randomKey = `${Date.now()}${randomBytes(6).toString('hex')}`;
    const res = await fetch(baseUrl + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-iyzi-rnd': randomKey,
        Authorization: iyzicoAuthHeader(apiKey, secretKey, randomKey, path, body),
      },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const json = (await res.json().catch(() => null)) as (T & { status?: string; errorCode?: string; errorMessage?: string }) | null;
    if (!json) throw new IyzicoError(`iyzico yanıtı okunamadı (HTTP ${res.status})`);
    return json;
  }

  async initialize(req: CfInitializeRequest) {
    const r = await this.post<{ status?: string; token?: string; paymentPageUrl?: string; checkoutFormContent?: string; errorCode?: string; errorMessage?: string }>(CF_INITIALIZE_PATH, req);
    if (r.status !== 'success' || !r.token || !r.paymentPageUrl) {
      this.logger.warn(`iyzico initialize başarısız: ${r.errorCode} ${r.errorMessage}`);
      throw new IyzicoError(`iyzico ödeme sayfası açılamadı: ${r.errorMessage ?? 'bilinmeyen hata'}`, r.errorCode);
    }
    return { token: r.token, paymentPageUrl: r.paymentPageUrl };
  }

  /**
   * Anahtar kontrolü: imzalı, ödeme oluşturmayan bir BIN sorgusu. Anahtar/imza hatalıysa iyzico
   * status=failure ve hata kodu döner.
   */
  ping() {
    return this.post<{ status?: string; errorCode?: string; errorMessage?: string; cardAssociation?: string; bankName?: string }>(BIN_CHECK_PATH, {
      locale: 'tr',
      conversationId: 'anahtar-kontrolu',
      binNumber: '55287900',
    });
  }

  retrieve(token: string, conversationId: string) {
    return this.post<CfRetrieveResult>(CF_RETRIEVE_PATH, { locale: 'tr', conversationId, token });
  }
}
