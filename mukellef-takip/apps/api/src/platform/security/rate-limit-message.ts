/**
 * Hız sınırı aşılınca kullanıcıya gösterilen Türkçe mesaj (kütüphanenin varsayılanı "ThrottlerException: Too Many Requests").
 * Engel süresi biliniyorsa (giriş uçları: 15 dk) kalan dakika yazılır. Müşavir ve satış API'si aynı metni kullanır.
 */
export function rateLimitMessage(detail: { isBlocked: boolean; timeToBlockExpire: number }): string {
  if (detail.isBlocked && detail.timeToBlockExpire > 0) {
    const min = Math.ceil(detail.timeToBlockExpire / 60);
    return `Çok fazla deneme yaptınız. Güvenliğiniz için ${min} dakika sonra tekrar deneyin.`;
  }
  return 'Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.';
}
