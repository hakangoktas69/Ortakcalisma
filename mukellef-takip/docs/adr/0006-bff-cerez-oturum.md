# 0006 — Oturum: dönen refresh token, web'de BFF + HttpOnly çerez

- **Durum:** Kabul (2026-10-20); API Faz 2, web Faz 3
- **Bağlam:** 8 saatlik JWT `localStorage`'da; XSS ile çalınabilir.
- **Karar:** 15 dk access token + DB'de hash'li dönen refresh token (`Session`: kullanıcı, cihaz, son kullanım, aile kimliği; yeniden kullanımda aile iptali). Web: Next.js route handler BFF token'ları `HttpOnly; Secure; SameSite=Strict` çerezde tutar, tarayıcı JS'i token görmez. Mobil: SecureStore + biyometrik kilit. Mevcut her istekte DB kontrolü (`sessionVersion`) korunur.
