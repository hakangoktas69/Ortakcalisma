import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Kurum şifrelerini (SGK, GİB) veritabanında şifreli tutar.
 * Biçim: "v1:<iv>:<authTag>:<ciphertext>" (hepsi base64, AES-256-GCM).
 *
 * Anahtar şimdilik VAULT_KEY ortam değişkeninden gelir. Üretimde bu anahtar
 * bir KMS (ör. HashiCorp Vault, AWS KMS) içinde tutulmalı; sürüm öneki ("v1")
 * ileride anahtar döndürmeyi (rotation) mümkün kılar.
 */
@Injectable()
export class VaultService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.VAULT_KEY;
    if (!raw) throw new Error('VAULT_KEY tanımlı değil');
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) throw new Error('VAULT_KEY 32 bayt (base64) olmalı');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    const [version, iv, tag, ct] = payload.split(':');
    if (version !== 'v1' || !iv || !tag || !ct) throw new Error('Geçersiz şifreli veri');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  }
}
