# assistant

> Alt alan: Destekleyici · Kod: `apps/api/src/modules/assistant/` · Şema: `prisma/schema/assistant.prisma` · Kalıp: **ACL** (Claude API)

## Sorumluluk

"Uzmana Sor": vergi/SGK mevzuatı hakkında **genel** sorular; yanıt Server-Sent Events ile akar. Değerimiz güvenli kullanım: kişisel veri maskeleme, yurt dışı aktarım onayı, kota, sohbet gizliliği.
**Yapmaz:** portal verisine (firmalar, beyannameler, SGK) erişmez; yalnız kullanıcının yazdığı soru gider.

## Model

| Toplam | Kimlik | Değişmezler |
|---|---|---|
| `AssistantConversation` (+ `AssistantMessage`) | `id`; sahibi `userId` | Sohbeti **yalnız sahibi** görür (yönetici dahil başkası göremez) · mesajlar maskeli hâliyle saklanır, `redactions` neyin gizlendiğini tutar |

## İş kuralları

- `shared-kernel/pii-redact.ts` `redactPii()` — TCKN, VKN, IBAN, SGK sicil, cep telefonu, e-posta (bilerek geniş). İsimler otomatik gizlenemez → arayüz uyarır.
- Yurt dışı aktarım (KVKK md.9): `ASSISTANT_MODE=anthropic` iken `Tenant.assistantConsentAt` yoksa **403 `ASSISTANT_CONSENT_REQUIRED`**. Demo (`mock`) modunda onay gerekmez (veri dışarı çıkmaz).
- Kota: büro başına günlük `ASSISTANT_DAILY_LIMIT` (denetim kaydından sayılır; sohbet silmek kotayı geri vermez; denetim kaydına soru metni yazılmaz).

## Kullanım senaryoları

`AssistantService`: `status`, `setConsent` (ADMIN), `conversations`, `conversation`, `remove`, `prepare` (akış öncesi kontroller HTTP koduyla döner) + `run` (akış). Sağlayıcı soyutlaması `infrastructure/assistant.providers.ts`: `anthropic` / `mock` / `off`; web araması yalnız resmi alan adlarında.

## HTTP uçları

`GET /api/assistant/status` · `PUT /api/assistant/consent` (ADMIN) · `GET /api/assistant/conversations[/:id]` · `DELETE /api/assistant/conversations/:id` · `POST /api/assistant/ask` (SSE: `meta → delta… → done | error`; hız sınırı)

## Testler

`application/assistant.service.spec.ts`, `infrastructure/anthropic-provider.spec.ts` (sahte sunucuya karşı akış biçimi), `shared-kernel/pii-redact.spec.ts` · e2e `test/billing-documents-assistant.e2e-spec.ts` (maskeleme veritabanında, akış, sahiplik, onay yetkisi).

## Bilinen sınırlar

Claude API gerçek anahtarla denenmedi; KVKK aydınlatma metnine yurt dışı aktarım eklenmeli; web'de onay ekranı yok.
