// Paylaşılan çekirdek (shared kernel): saf değer nesneleri ve ortak tipler. Hiçbir pakete bağımlı değildir.
export { err, ok, type Result } from './result.ts';
export { isValidTckn, isValidVkn, maskTaxId, parseTaxId, type TaxId } from './tax-id.ts';
export { formatPeriod, parsePeriod, type Period } from './period.ts';
export { toCsv, type CsvColumn } from './csv.ts';

/** Bağlamlar arası olayların ortak zarfı; yük şeması contracts/events altındadır. */
export type DomainEvent<TName extends string = string, TPayload = unknown> = {
  readonly name: TName;
  readonly orgId: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
};

/** Domain katmanı saati doğrudan okumaz (06 §4); zaman bu port üzerinden gelir. */
export type Clock = { now(): Date };
