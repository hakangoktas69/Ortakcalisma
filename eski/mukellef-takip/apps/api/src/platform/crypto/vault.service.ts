import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/** Şifreleme anahtarları: kimlik → 32 baytlık anahtar. `current` yeni şifrelemede kullanılır. */
export interface KeyRing {
  current: string;
  keys: Map<string, Buffer>;
}

/** "v1": VAULT_KEY ile (eski biçim, geliştirme). Diğer kimlikler "v2:<kimlik>" biçiminde yazılır. */
export const LOCAL_KEY_ID = 'local';

export function localKeyRing(rawBase64 = process.env.VAULT_KEY): KeyRing {
  if (!rawBase64) throw new Error('VAULT_KEY tanımlı değil');
  const key = Buffer.from(rawBase64, 'base64');
  if (key.length !== 32) throw new Error('VAULT_KEY 32 bayt (base64) olmalı');
  return { current: LOCAL_KEY_ID, keys: new Map([[LOCAL_KEY_ID, key]]) };
}

/**
 * Kurum şifrelerini (SGK, GİB) ve kişisel veri kolonlarını uygulama düzeyinde AES-256-GCM ile şifreler.
 *
 * Biçimler (hepsi base64 parçalı):
 * - "v1:<iv>:<tag>:<ct>"          VAULT_KEY (yerel anahtar) — geliştirme ve eski kayıtlar
 * - "v2:<kid>:<iv>:<tag>:<ct>"    OpenBao Transit ile sarılmış veri anahtarı (docs/adr/0005)
 *
 * Anahtarın kendisi veritabanında ve (üretimde) ortam değişkeninde bulunmaz; açılışta KMS'ten çözülür
 * (bkz. kms.ts). Eski sürümle yazılmış kayıt okunmaya devam eder; `needsRotation` yeniden şifreleme işine yol gösterir.
 */
@Injectable()
export class VaultService {
  private readonly ring: KeyRing;
  private readonly indexKey: Buffer;

  constructor(ring?: KeyRing) {
    this.ring = ring ?? localKeyRing();
    if (!this.ring.keys.has(this.ring.current)) throw new Error('Geçerli şifreleme anahtarı anahtar halkasında yok');
    // Blind index anahtarı veri anahtarından türetilir; şifreleme anahtarıyla aynı değildir
    this.indexKey = Buffer.from(hkdfSync('sha256', this.ring.keys.get(this.ring.current)!, Buffer.alloc(0), 'mukellef-blind-index', 32));
  }

  encrypt(plain: string): string {
    const kid = this.ring.current;
    const key = this.ring.keys.get(kid)!;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const parts = [iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')];
    return (kid === LOCAL_KEY_ID ? ['v1', ...parts] : ['v2', kid, ...parts]).join(':');
  }

  decrypt(payload: string): string {
    const segs = payload.split(':');
    let kid: string;
    let rest: string[];
    if (segs[0] === 'v1' && segs.length === 4) [kid, rest] = [LOCAL_KEY_ID, segs.slice(1)];
    else if (segs[0] === 'v2' && segs.length === 5) [kid, rest] = [segs[1], segs.slice(2)];
    else throw new Error('Geçersiz şifreli veri');
    const key = this.ring.keys.get(kid);
    if (!key) throw new Error(`Şifre çözme anahtarı bulunamadı (${kid})`);
    const [iv, tag, ct] = rest;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  }

  encryptNullable(plain: string | null | undefined): string | null {
    return plain === null || plain === undefined ? null : this.encrypt(plain);
  }

  decryptNullable(payload: string | null | undefined): string | null {
    return payload ? this.decrypt(payload) : null;
  }

  /** Kayıt güncel anahtarla mı şifrelenmiş? Değilse yeniden şifreleme işi bu kaydı çevirir. */
  needsRotation(payload: string): boolean {
    const kid = payload.startsWith('v1:') ? LOCAL_KEY_ID : payload.split(':')[1];
    return kid !== this.ring.current;
  }

  /**
   * Şifreli bir kolonu eşitlikle aramak / tekil kısıt koymak için kararlı özet (HMAC-SHA256).
   * `purpose` farklı alanların özetlerinin karşılaştırılamamasını sağlar ("tckn", "phone"…).
   */
  blindIndex(purpose: string, value: string): string {
    return createHmac('sha256', this.indexKey).update(`${purpose}:${value}`).digest('base64url');
  }
}
