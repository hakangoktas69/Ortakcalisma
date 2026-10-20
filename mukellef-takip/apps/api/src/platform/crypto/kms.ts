import { createHash } from 'node:crypto';
import type { AppConfig } from '../config/config.js';
import { type KeyRing, LOCAL_KEY_ID, localKeyRing } from './vault.service.js';

/**
 * Açılışta şifreleme anahtar halkasını kurar.
 * - local: VAULT_KEY (geliştirme).
 * - openbao: OPENBAO_WRAPPED_DEK, OpenBao Transit'e çözdürülür; düz anahtar yalnız süreç belleğinde kalır.
 *   VAULT_KEY de verilmişse eski "v1" kayıtları okumak için halkaya eklenir (yeniden şifreleme dönemi).
 */
export async function loadKeyRing(c: Pick<AppConfig, 'KMS_PROVIDER' | 'VAULT_KEY' | 'OPENBAO_ADDR' | 'OPENBAO_TOKEN' | 'OPENBAO_TRANSIT_KEY' | 'OPENBAO_WRAPPED_DEK'>, fetchImpl: typeof fetch = fetch): Promise<KeyRing> {
  if (c.KMS_PROVIDER === 'local') return localKeyRing(c.VAULT_KEY);

  const wrapped = c.OPENBAO_WRAPPED_DEK!;
  const url = `${c.OPENBAO_ADDR!.replace(/\/+$/, '')}/v1/transit/decrypt/${encodeURIComponent(c.OPENBAO_TRANSIT_KEY)}`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'X-Vault-Token': c.OPENBAO_TOKEN!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext: wrapped }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenBao veri anahtarını çözemedi (HTTP ${res.status}); kasa mühürlü (sealed) olabilir`);
  const body = (await res.json()) as { data?: { plaintext?: string } };
  const key = Buffer.from(body.data?.plaintext ?? '', 'base64');
  if (key.length !== 32) throw new Error('OpenBao veri anahtarı 32 bayt değil');

  // Anahtar kimliği: Transit anahtar sürümü + sarılmış anahtarın kısa özeti (aynı sürümde yeni DEK ayrışsın)
  const version = /^vault:v(\d+):/.exec(wrapped)?.[1] ?? '0';
  const kid = `b${version}${createHash('sha256').update(wrapped).digest('hex').slice(0, 6)}`;
  const keys = new Map<string, Buffer>([[kid, key]]);
  if (c.VAULT_KEY) keys.set(LOCAL_KEY_ID, localKeyRing(c.VAULT_KEY).keys.get(LOCAL_KEY_ID)!);
  return { current: kid, keys };
}

/**
 * OpenBao uygulama anahtarı süreli (periodic) üretilir: süreç açıkken günde iki kez yenilenir.
 * Yenilenmezse 32 gün sonra geçersizleşir ve bir sonraki açılışta veri anahtarı çözülemez.
 */
export function startOpenBaoTokenRenewal(c: Pick<AppConfig, 'KMS_PROVIDER' | 'OPENBAO_ADDR' | 'OPENBAO_TOKEN'>, fetchImpl: typeof fetch = fetch) {
  if (c.KMS_PROVIDER !== 'openbao') return;
  const renew = () =>
    fetchImpl(`${c.OPENBAO_ADDR!.replace(/\/+$/, '')}/v1/auth/token/renew-self`, {
      method: 'POST',
      headers: { 'X-Vault-Token': c.OPENBAO_TOKEN! },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  void renew();
  setInterval(renew, 12 * 3_600_000).unref();
}
