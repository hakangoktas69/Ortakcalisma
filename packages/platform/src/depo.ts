import { CreateBucketCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

// S3 uyumlu nesne deposu (D35: Compose'da SeaweedFS). Anahtarlar ofis önekli: org/<org_id>/… — ofisler arası karışmaz.

export type DepoAyar = { endpoint: string; bucket: string; accessKey: string; secretKey: string; region: string };

export class Depo {
  private readonly s3: S3Client;
  readonly bucket: string;

  constructor(a: DepoAyar) {
    this.bucket = a.bucket;
    this.s3 = new S3Client({ endpoint: a.endpoint, region: a.region, forcePathStyle: true, credentials: { accessKeyId: a.accessKey, secretAccessKey: a.secretKey } });
  }

  async hazirla() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket })).catch(() => {});
    }
  }

  async koy(anahtar: string, govde: Buffer | string, tur: string) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: anahtar, Body: govde, ContentType: tur }));
  }

  async akis(anahtar: string): Promise<{ govde: Readable; boyut: number | undefined; tur: string | undefined }> {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: anahtar }));
    return { govde: r.Body as Readable, boyut: r.ContentLength, tur: r.ContentType };
  }

  /** Nesne yoksa null (süresi dolup silinmiş belge). */
  async akisVarsa(anahtar: string) {
    try {
      return await this.akis(anahtar);
    } catch (e) {
      if ((e as { name?: string }).name === 'NoSuchKey' || (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  async sil(anahtar: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: anahtar }));
  }

  /** Toplu silme (en çok 1000 anahtar/istek). */
  async topluSil(anahtarlar: readonly string[]) {
    for (let i = 0; i < anahtarlar.length; i += 1000) {
      const parca = anahtarlar.slice(i, i + 1000);
      await this.s3.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: parca.map((Key) => ({ Key })), Quiet: true } }));
    }
  }

  async json<T>(anahtar: string, sinir = 50 * 1024 * 1024): Promise<T> {
    const { govde, boyut } = await this.akis(anahtar);
    if (boyut !== undefined && boyut > sinir) throw new Error('Sonuç dosyası çok büyük');
    const parcalar: Buffer[] = [];
    let toplam = 0;
    for await (const p of govde) {
      toplam += (p as Buffer).length;
      if (toplam > sinir) throw new Error('Sonuç dosyası çok büyük');
      parcalar.push(p as Buffer);
    }
    return JSON.parse(Buffer.concat(parcalar).toString('utf8')) as T;
  }
}
