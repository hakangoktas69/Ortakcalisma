/* Sadece kanıtlanabilir örnek kayıtları ayırır; GİB sözleşmelerini korur. */
(function (root) {
    "use strict";
    const names = [
        "Mavi Atlas Danışmanlık Ltd. Şti.",
        "Kuzey Rota Teknoloji A.Ş.",
        "Deniz Yıldızı Ticaret",
        "Arma Yapı Proje Ltd. Şti.",
        "Yeni Nesil Tasarım Ofisi",
        "Marmara Gıda Pazarlama Ltd.",
        "Güneş Mobilya Canlı A.Ş.",
        "Kent Yazılım Çözümleri",
        "Pera Sağlık Hizmetleri",
        "Ada Eğitim Danışmanlığı",
        "Anka Medya ve Reklam Ltd.",
        "Elit Lojistik ve Taşımacılık",
        "Rota Dijital Hizmetler",
        "Çınar Tekstil Sanayi Ltd.",
        "Delta Makine Endüstri A.Ş.",
        "Nova Serbest Meslek",
        "Merkez Kırtasiye Ticaret",
        "Umut Mühendislik Ltd. Şti.",
    ];
    const tasks = [
        ["T-1", "Eylül dönemi e-Defter dosyaları", names[1], "2026-10-14", "Bekliyor", "Ofis"],
        ["T-2", "Muhtasar ve prim hizmet kontrolü", names[0], "2026-10-16", "Devam Ediyor", "Muhasebe"],
        ["T-3", "Yeni gelen e-Tebligatın incelenmesi", names[3], "2026-10-12", "Öncelikli", "Ofis"],
        ["T-4", "Evrak eksiklerinin tamamlanması", names[8], "2026-10-19", "Bekliyor", "Mükellef"],
        ["T-5", "SGK e-Rapor arşiv kontrolü", names[6], "2026-10-23", "Tamamlandı", "İK"],
    ];
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const tagged = (row) => row && (["simulation", "demo", "sample"].includes(row.sourceType) || row.isDemo === true);
    const realFirm = (row) => row && (["gib_live", "gib_export"].includes(row.sourceType) || (Array.isArray(row.contracts) && row.contracts.length > 0) || /^\d{10}$/.test(row.taxNumber || "") || /^\d{11}$/.test(row.identityNumber || ""));
    const demoFirm = (row) => !realFirm(row) && (tagged(row) || names.some((name, index) => row.id === "F" + (index + 1) && row.name === name));
    const demoTask = (row) => tagged(row) || tasks.some((values) => ["id", "title", "firm", "due", "status", "owner"].every((key, index) => row[key] === values[index]));
    const legacyOverride = (id) =>
        /^(declarations(?:-view|-check)?|pilot-settings|notices|sgk(?:-check|-report|-bildirge|-entry|-accident)?|petitions(?:-all|-debt)?|invoices(?:-e|-archive|-receipts|-withhold)?|reports(?:-pos|-cars|-trade|-audit)?|payments(?:-month|-cash|-debt|-online|-fees|-stats|-settings)?|accounts(?:-office|-clients)?|settings(?:-profile|-comms|-groups|-install)?|expert|suggest|faq|news)-([1-9]|[12]\d|30)$/.test(
            id,
        );

    function clean(state) {
        const data = clone(state);
        if (data.demoCleanup?.version === 1) return { data, changed: false, total: 0 };
        const removed = { firms: [], tasks: [], notes: [], uploaded: [], overrides: {} };
        for (const [key, predicate] of [
            ["firms", demoFirm],
            ["tasks", demoTask],
            ["notes", tagged],
            ["uploaded", tagged],
        ]) {
            data[key] = (Array.isArray(data[key]) ? data[key] : []).filter((row) => {
                if (predicate(row)) {
                    removed[key].push(row);
                    return false;
                }
                return true;
            });
        }
        data.overrides = data.overrides || {};
        const recordIds = new Set(data.notes.map((row) => row.id));
        for (const [id, value] of Object.entries(data.overrides)) {
            if (legacyOverride(id) && !recordIds.has(id)) {
                removed.overrides[id] = value;
                delete data.overrides[id];
            }
        }
        const total = removed.firms.length + removed.tasks.length + removed.notes.length + removed.uploaded.length + Object.keys(removed.overrides).length;
        if (total) data.demoCleanup = { version: 1, createdAt: new Date().toISOString(), restored: false, removed };
        return { data, changed: total > 0, total };
    }

    function restore(state) {
        const data = clone(state),
            archive = data.demoCleanup;
        if (!archive || archive.restored) return { data, restored: 0 };
        let count = 0;
        for (const key of ["firms", "tasks", "notes", "uploaded"]) {
            data[key] = Array.isArray(data[key]) ? data[key] : [];
            const ids = new Set(data[key].map((row) => row.id));
            for (const row of archive.removed[key] || []) {
                if (!ids.has(row.id)) {
                    data[key].push(row);
                    ids.add(row.id);
                    count++;
                }
            }
        }
        data.overrides = data.overrides || {};
        for (const [id, value] of Object.entries(archive.removed.overrides || {})) {
            if (!Object.hasOwn(data.overrides, id)) {
                data.overrides[id] = value;
                count++;
            }
        }
        archive.restored = true;
        return { data, restored: count };
    }
    const api = { clean, restore };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    else root.EworksDataCleanup = api;
})(typeof window !== "undefined" ? window : globalThis);
