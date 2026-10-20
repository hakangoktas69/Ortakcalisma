import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import {
  ViziteError,
  toSgkDate,
  type ViziteClient,
  type ViziteCredentials,
  type ViziteReportRow,
} from '../../application/ports/vizite.types.js';

const ENDPOINT = process.env.SGK_VIZITE_URL ?? 'https://uyg.sgk.gov.tr/Ws_Vizite/services/ViziteGonder';
// WSDL: document/literal, SOAP 1.1, istek kökü http://service.com isim alanında, alt alanlar nitelendirilmemiş.
const NS = 'http://service.com';
const TIMEOUT_MS = 30_000;

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

/**
 * SGK Vizite web servisinin gerçek (canlı) istemcisi.
 * Sadece SGK_MODE=live iken kullanılır.
 */
@Injectable()
export class SoapViziteClient implements ViziteClient {
  readonly mode = 'live' as const;
  private readonly logger = new Logger(SoapViziteClient.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    parseTagValue: false, // Kimlik no ve rapor id'leri string kalmalı (baştaki sıfırlar, 18 haneli id'ler)
    isArray: (name) => name.endsWith('Bean'),
  });

  private async call(method: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
    const body = Object.entries(fields)
      .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
      .join('');
    const envelope =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${NS}">` +
      `<soapenv:Body><ser:${method}>${body}</ser:${method}></soapenv:Body></soapenv:Envelope>`;

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: method },
      body: envelope,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    const doc = this.parser.parse(text);
    const fault = doc?.Envelope?.Body?.Fault;
    if (fault) throw new ViziteError(method, -1, String(fault.faultstring ?? 'SOAP Fault'));
    if (!res.ok) throw new ViziteError(method, -res.status, `HTTP ${res.status}`);

    const ret = doc?.Envelope?.Body?.[`${method}Response`]?.[`${method}Return`];
    if (!ret) throw new ViziteError(method, -1, 'Beklenmeyen yanıt');
    const code = Number(ret.sonucKod);
    if (code !== 0) throw new ViziteError(method, code, String(ret.sonucAciklama ?? ''));
    return ret;
  }

  private base(c: ViziteCredentials, token: string) {
    return { kullaniciAdi: c.kullaniciAdi, isyeriKodu: c.isyeriKodu, wsToken: token };
  }

  private rows(ret: Record<string, unknown>, key: string, inner: string): ViziteReportRow[] {
    const arr = (ret[key] as Record<string, unknown> | undefined)?.[inner];
    return Array.isArray(arr) ? (arr as ViziteReportRow[]) : [];
  }

  async login(c: ViziteCredentials) {
    const ret = await this.call('wsLogin', {
      kullaniciAdi: c.kullaniciAdi,
      isyeriKodu: c.isyeriKodu,
      isyeriSifresi: c.isyeriSifresi,
    });
    return String(ret.wsToken);
  }

  async pendingReports(c: ViziteCredentials, token: string, before: Date) {
    try {
      const ret = await this.call('raporAramaTarihile', { ...this.base(c, token), tarih: toSgkDate(before) });
      return this.rows(ret, 'raporAramaTarihleBeanArray', 'RaporAramaTarihleBean');
    } catch (e) {
      if (e instanceof ViziteError && e.isEmpty) return [];
      throw e;
    }
  }

  async markRead(c: ViziteCredentials, token: string, medulaRaporId: string) {
    await this.call('raporOkunduKapat', { ...this.base(c, token), medulaRaporId });
  }

  async approvedReports(c: ViziteCredentials, token: string, from: Date, to: Date) {
    try {
      const ret = await this.call('onayliRaporlarTarihile', {
        ...this.base(c, token),
        tarih1: toSgkDate(from),
        tarih2: toSgkDate(to),
      });
      return this.rows(ret, 'onayliRaporlarTarihleBeanArray', 'OnayliRaporlarTarihleBean');
    } catch (e) {
      if (e instanceof ViziteError && e.isEmpty) return [];
      throw e;
    }
  }

  async approve(
    c: ViziteCredentials,
    token: string,
    input: { tckn: string; vaka: number; medulaRaporId: string; nitelikDurumu: '0' | '1'; tarih: Date },
  ) {
    this.logger.log(`raporOnay medulaRaporId=${input.medulaRaporId}`);
    await this.call('raporOnay', {
      ...this.base(c, token),
      tckNo: input.tckn,
      vaka: String(input.vaka),
      medulaRaporId: input.medulaRaporId,
      nitelikDurumu: input.nitelikDurumu,
      tarih: toSgkDate(input.tarih),
    });
  }
}
