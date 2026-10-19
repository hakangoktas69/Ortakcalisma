import { Injectable } from '@nestjs/common';
import { TescilError, type TescilClient } from './tescil.types.js';

const NOT_READY =
  'Canlı 4A işe giriş/çıkış bağlantısı henüz kurulmadı: SGK kullanım kılavuzu ' +
  '(4atescilWS_Kullanim_Kilavuzu) ve test ortamı erişimi bekleniyor.';

/**
 * SGK 4A Sigortalı Tescil web servisinin canlı istemcisi.
 * Metot/alan adları resmi kılavuzdan doğrulanana kadar bilinçli olarak devre dışı:
 * tahmini adlarla istek atmak yerine açık bir hata verir.
 */
@Injectable()
export class LiveTescilClient implements TescilClient {
  readonly mode = 'live' as const;

  verify(): Promise<void> {
    return Promise.reject(new TescilError('NOT_READY', NOT_READY));
  }

  entries(): Promise<never> {
    return Promise.reject(new TescilError('NOT_READY', NOT_READY));
  }

  exits(): Promise<never> {
    return Promise.reject(new TescilError('NOT_READY', NOT_READY));
  }
}
