// T.C. kimlik numarası: doğrulama ve ekranda maskeleme (kişisel veri; tam hâli gösterilmez).

/** T.C. kimlik no kontrol haneleri (resmi algoritma). */
export function isValidTckn(s: string): boolean {
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

/** "12345678901" → "123*****901" */
export const maskTckn = (t: string) => (t.length === 11 ? `${t.slice(0, 3)}*****${t.slice(-3)}` : t);
