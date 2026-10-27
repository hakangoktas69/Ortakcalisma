# contracts — yayımlanmış dil

Python ACL ile TypeScript alan katmanı arasındaki ve bağlamlar arası olay yüklerinin JSON Schema tanımları ([06 §3](../docs/hedef-mimari/06-kaynak-kod-yapisi-ddd-tdd.md#3-depo-yapısı)).

- `integration/eworks.<kurum>.<servis>.<ad>.v<N>.schema.json` — ACL çıktısı (ör. `eworks.gib.ebeyanname.contracts.v1`). Kırıcı değişiklik = yeni sürüm.
- `events/<bağlam>.<olay>.v<N>.schema.json` — bağlamlar arası olay yükleri (zarf: `@eworks/kernel` `DomainEvent`).
- Her şema iki tarafta da sözleşme testiyle doğrulanır (`pnpm test`, `uv run pytest`). Yüke kişisel veri yalnız gerekiyorsa ve sınıfı belirtilerek girer.
- `integration/eworks.calendar.sources.v1.schema.json` — takvim kaynakları (GİB vergi takvimi + dinî bayramlar; kişisel veri yok).
- `integration/eworks.gib.notices.v1.schema.json` — e-Tebligat listesi (belge açılmaz; kurum kimliği özetli; şahıs firmasında kişisel veri sayılabilir).
