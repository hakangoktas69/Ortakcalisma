// Para tutarları (TL). Kuruş hesabı kayan nokta hatasına karşı ondalık gösterimle yapılır.

/**
 * Kuruşa yuvarlama. amount * 100 kayan noktada hatalı olabilir (1.005 * 100 = 100.49999…);
 * bu yüzden ondalık gösterimle kaydırılır: Number("1.005e2") = 100.5.
 */
export function roundKurus(amount: number): number {
  return Math.round(Number(`${amount}e2`)) / 100;
}
