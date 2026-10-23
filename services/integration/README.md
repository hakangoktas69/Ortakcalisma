# services/integration — kurum entegrasyonu (Python ACL)

Kurumla konuşan tek katman: web servis birincil, robot yedek (D19). Çıktısı `contracts/integration/*.schema.json` biçimindedir; alan tablolarına yazmaz, sonucu `apps/worker` uygular. Yapı: [06 §3](../../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#3-depo-yapısı), kapasite ve hız: [02](../../docs/hedef-mimari/02-kurum-entegrasyon-robotu.md).

```bash
uv sync && uv run pytest && uv run lint-imports
```

Taşınacak modüller (`eski/mert/eworks/entegrasyon-1-tarayici/Eworks-Python-Robot`) testleriyle birlikte `institutions/...` altına alınır; testler önce sahte kurum sunucusuyla kırmızıya çevrilir (06 §9). Testler `@pytest.mark.feature("<anahtar>")` ile özelliğe bağlanır.
