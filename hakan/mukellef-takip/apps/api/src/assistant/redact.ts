/**
 * Asistana gönderilen metinden kişisel / mükellefe ait tanımlayıcıları maskeler. Metin yapay zekâ
 * servisine ve veritabanına sadece maskelenmiş hâliyle gider. Sıra önemlidir: uzun numaralar
 * (IBAN, SGK sicil no) önce, 10–11 haneli numaralar sonra maskelenir.
 *
 * Bilerek geniş tutuldu: 10 haneli bir tutar da VKN sanılıp maskelenebilir. Mevzuat sorusu için
 * bu kayıp önemsizdir; kimlik numarasının dışarı çıkması değildir.
 */
export type RedactionKind = 'iban' | 'email' | 'sicil' | 'telefon' | 'tckn' | 'vkn';

const RULES: { kind: RedactionKind; label: string; re: RegExp }[] = [
  { kind: 'iban', label: '[IBAN]', re: /\bTR(?:\s?\d){24}\b/gi },
  { kind: 'email', label: '[E-POSTA]', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  // İşyeri sicil no: boşluk/nokta/tireyle ayrılmış en az 20 rakam
  { kind: 'sicil', label: '[SİCİL NO]', re: /(?<!\d)\d(?:[\s.-]?\d){19,29}(?!\d)/g },
  // Cep telefonu: +90 / 0 ile ya da doğrudan 5xx
  { kind: 'telefon', label: '[TELEFON]', re: /(?<!\d)(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g },
  { kind: 'tckn', label: '[TCKN]', re: /(?<!\d)[1-9]\d{10}(?!\d)/g },
  { kind: 'vkn', label: '[VKN]', re: /(?<!\d)\d{10}(?!\d)/g },
];

export function redactPii(input: string): { text: string; redactions: Partial<Record<RedactionKind, number>> } {
  let text = input;
  const redactions: Partial<Record<RedactionKind, number>> = {};
  for (const { kind, label, re } of RULES) {
    text = text.replace(re, () => {
      redactions[kind] = (redactions[kind] ?? 0) + 1;
      return label;
    });
  }
  return { text, redactions };
}
