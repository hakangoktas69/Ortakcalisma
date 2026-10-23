# Mobil (Expo / React Native) — Faz 4, henüz kod yok

Genel kurallar: `../../CLAUDE.md`. Karar: `../../docs/adr/0007-expo-mobil.md`.

## Hedef
- Expo (güncel SDK), expo-router, TypeScript; npm workspace olarak eklenir.
- Kapsam: iş kutusu, bildirimler, e-tebligat, beyanname durumu, SGK e-rapor onayı. Toplu veri girişi ve ayarlar web'de.
- Tipler ve API istemcisi `packages/contracts`'tan; web ile aynı uçlar.

## Güvenlik kuralları
- Oturum: refresh token `expo-secure-store`'da; uygulama açılışında `expo-local-authentication` (biyometri/PIN). Access token yalnız bellekte.
- Push (`expo-notifications`): yükte kişisel veri yok — yalnız "Yeni işiniz var" + derin bağlantı; içerik uygulama açılınca API'den çekilir.
- TLS sertifika sabitleme (prod); arka plana geçişte ekran bulanıklaştırma; root/jailbreak tespitinde uyarı.
- Kişisel veri cihazda kalıcı önbelleğe yazılmaz (yalnız bellek); çıkışta her şey silinir.
- Analitik/hata takibi yalnız self-hosted ve PII'sız.
