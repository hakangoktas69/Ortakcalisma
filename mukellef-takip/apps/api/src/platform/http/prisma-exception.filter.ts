import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

// Veritabanı kısıt ihlallerini anlamlı HTTP yanıtına çevirir (aksi hâlde 500 olur).
// Yanıtta tablo/kolon adı veya değer gösterilmez (iç yapı ve kişisel veri sızmasın).
const MAP: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Bu kayıt zaten var' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Kayıt bulunamadı' },
  P2003: { status: HttpStatus.CONFLICT, message: 'Kayıt başka kayıtlarla ilişkili ya da ilişkili kayıt yok' },
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Değer çok uzun' },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const known = MAP[e.code];
    if (!known) {
      this.logger.error(`Veritabanı hatası ${e.code}`);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
      return;
    }
    res.status(known.status).json({ statusCode: known.status, message: known.message, code: e.code });
  }
}
