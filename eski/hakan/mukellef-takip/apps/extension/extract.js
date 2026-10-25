// Kullanıcının açık olan sayfasındaki HTML tablolarını okur. Sadece okur: sayfada hiçbir şeyi
// değiştirmez, tıklamaz, GİB'e istek atmaz. Popup tarafından chrome.scripting ile, kullanıcı
// "Bu sayfayı oku" düğmesine bastığında enjekte edilir; dosyanın son ifadesinin değeri sonuç olarak döner.
(() => {
  const MAX_TABLES = 50;
  const MAX_ROWS = 5000;
  const MAX_CELL = 300;

  const text = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, MAX_CELL);

  // İç içe tablolarda sadece en içteki veri tablosunu al
  const tables = [...document.querySelectorAll('table')].filter((t) => !t.querySelector('table'));

  const out = [];
  for (const table of tables) {
    if (out.length >= MAX_TABLES) break;
    const rows = [...table.rows].filter((r) => r.cells.length > 1);
    if (rows.length < 2) continue;

    // Başlık satırı: <thead> varsa onun son satırı, yoksa <th> içeren ilk satır, o da yoksa ilk satır
    let headerRow = table.tHead && table.tHead.rows.length ? table.tHead.rows[table.tHead.rows.length - 1] : null;
    if (!headerRow) headerRow = rows.find((r) => r.querySelector('th')) || rows[0];

    const headers = [...headerRow.cells].map(text);
    const body = rows
      .filter((r) => r !== headerRow && !(table.tHead && table.tHead.contains(r)))
      .slice(0, MAX_ROWS)
      .map((r) => [...r.cells].map(text));
    if (body.length) out.push({ headers, rows: body });
  }
  // SGK e-Bildirge: sayfa başlığında/metninde geçen işyeri sicil numarası adayları
  // (boşluk/nokta/tire ile ayrılmış, toplam en az 20 rakam). Sadece aday olarak gönderilir;
  // portal bunları kayıtlı işyerleriyle eşleştirir.
  const registryHints = [];
  const pageText = (document.body && document.body.innerText) || '';
  for (const m of pageText.matchAll(/\d[\d .\-]{18,58}\d/g)) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length >= 20 && digits.length <= 30 && !registryHints.includes(m[0].trim())) registryHints.push(m[0].trim());
    if (registryHints.length >= 20) break;
  }
  return { url: location.href, title: document.title, tables: out, registryHints };
})();
