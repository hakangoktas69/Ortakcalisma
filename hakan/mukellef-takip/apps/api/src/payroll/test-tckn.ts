/** İlk 9 haneden algoritmaya uygun bir T.C. kimlik no üretir (sadece test ve demo verisi için). */
export function makeTckn(first9: string): string {
  const d = first9.split('').map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const d10 = (((odd * 7 - even) % 10) + 10) % 10;
  const d11 = (d.reduce((s, x) => s + x, 0) + d10) % 10;
  return first9 + d10 + d11;
}
