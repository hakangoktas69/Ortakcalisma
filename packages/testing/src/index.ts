// Test yardımcıları. Gerçek kişisel veri hiçbir fikstüre girmez (06 §7.2): VKN/TCKN geçerli ama sahte üretilir.
export { asRole, yigin } from './yigin.ts';

/** Tohumlu, tekrarlanabilir sözde rastgele sayı üretici (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const digit = (rnd: () => number) => Math.floor(rnd() * 10);

/** Kontrol hanesi doğru, sahte TCKN. Önek 99 ile başlar: gerçek kişiyle çakışma riski azaltılır ve testte tanınır. */
export function fakeTckn(rnd: () => number = Math.random): string {
  const d = [9, 9, ...Array.from({ length: 7 }, () => digit(rnd))];
  const odd = (d[0] ?? 0) + (d[2] ?? 0) + (d[4] ?? 0) + (d[6] ?? 0) + (d[8] ?? 0);
  const even = (d[1] ?? 0) + (d[3] ?? 0) + (d[5] ?? 0) + (d[7] ?? 0);
  d.push((((odd * 7 - even) % 10) + 10) % 10);
  d.push(d.reduce((a, b) => a + b, 0) % 10);
  return d.join('');
}

/** Kontrol hanesi doğru, sahte VKN (GİB algoritması). */
export function fakeVkn(rnd: () => number = Math.random): string {
  const d = Array.from({ length: 9 }, () => digit(rnd));
  let sum = 0;
  d.forEach((x, i) => {
    const t = (x + 9 - i) % 10;
    sum += t === 0 ? 0 : (t * 2 ** (9 - i)) % 9 || 9;
  });
  return [...d, (10 - (sum % 10)) % 10].join('');
}
