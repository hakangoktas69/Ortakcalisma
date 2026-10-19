// Akış: 1) kullanıcı "Bu sayfayı oku"ya basar → extract.js sadece o sekmeye enjekte edilir
//       2) okunan tablolar önizleme için API'ye gönderilir (dryRun, hiçbir şey yazılmaz)
//       3) kullanıcı önizlemeyi görüp "Aktar"a basarsa aynı veri dryRun=false ile gönderilir.

const $ = (id) => document.getElementById(id);
const DEFAULT_API = 'http://localhost:4000/api';
let state = { apiUrl: DEFAULT_API, token: '', page: null, taxNumber: '', registryNo: '' };

function show(kind, html) {
  const el = $('msg');
  el.className = `box ${kind}`;
  el.innerHTML = html;
  el.hidden = !html;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function isAllowedPage(url) {
  try {
    const { hostname } = new URL(url);
    const official = (d) => hostname === d || hostname.endsWith('.' + d);
    return official('gib.gov.tr') || official('sgk.gov.tr') || hostname === 'localhost';
  } catch {
    return false;
  }
}

async function load() {
  const saved = await chrome.storage.local.get(['apiUrl', 'token']);
  state.apiUrl = saved.apiUrl || DEFAULT_API;
  state.token = saved.token || '';
  $('apiUrl').value = state.apiUrl;
  $('settings').hidden = !!state.token;
  $('main').hidden = !state.token;
}

async function save() {
  const apiUrl = $('apiUrl').value.trim().replace(/\/+$/, '') || DEFAULT_API;
  const token = $('token').value.trim() || state.token;
  if (!/^mt_/.test(token)) return show('err', 'Anahtar "mt_" ile başlamalı.');
  // localhost dışındaki API adresleri için o adrese erişim izni istenir
  const origin = new URL(apiUrl).origin + '/*';
  if (!origin.startsWith('http://localhost:4000')) {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) return show('err', 'API adresine erişim izni verilmedi.');
  }
  await chrome.storage.local.set({ apiUrl, token });
  $('token').value = '';
  show('ok', 'Ayarlar kaydedildi.');
  await load();
}

async function callImport(dryRun) {
  const res = await fetch(`${state.apiUrl}/import/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}` },
    body: JSON.stringify({
      pageUrl: state.page.url,
      tables: state.page.tables,
      dryRun,
      ...(state.taxNumber ? { taxNumber: state.taxNumber } : {}),
      ...(state.registryNo ? { registryNo: state.registryNo } : {}),
      ...(state.page.registryHints.length ? { pageRegistryHints: state.page.registryHints } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(res.status === 401 ? 'Anahtar geçersiz veya iptal edilmiş. Ayarlardan yeni anahtar girin.' : m || `Hata ${res.status}`);
  }
  return body;
}

function table(rows) {
  return `<table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
}

function renderPreview({ declarations: d, tebligat: t, ebildirge: b }) {
  let html = '';
  let writes = 0;

  if (d.tablesUsed) {
    writes += d.create + d.replaceManual + d.complete;
    html += `<div class="box info"><b>Beyannameler</b>${table([
      ['Tanınan', d.recognized],
      ['Yeni eklenecek', d.create],
      ['Elle girilenin yerine geçecek', d.replaceManual],
      ['Eksik bilgisi tamamlanacak', d.complete],
      ['Zaten kayıtlı', d.unchanged],
      ['Onaylanmamış (atlandı)', d.skippedNotApproved],
    ])}</div>`;
    if (d.unknownTypes.length) html += `<div class="box warn">Tanınmayan beyanname türleri (atlandı): ${d.unknownTypes.map(esc).join(', ')}</div>`;
    if (d.unknownPeriods.length) html += `<div class="box warn">Okunamayan dönemler: ${d.unknownPeriods.slice(0, 5).map(esc).join('; ')}</div>`;
  }

  if (t.tablesUsed) {
    if (t.needsTaxNumber) {
      html += `<div class="box warn"><b>e-Tebligat</b><br>Bu sayfada VKN/TCKN sütunu yok. Tebligatların ait olduğu mükellefin VKN/TCKN'sini girin:
        <input id="taxNumber" inputmode="numeric" placeholder="10 veya 11 hane" style="margin-top:6px" />
        <button id="retry" class="ghost">Önizlemeyi yenile</button></div>`;
    } else {
      writes += t.create + t.update;
      html += `<div class="box info"><b>e-Tebligat</b>${table([
        ['Tanınan', t.recognized],
        ['Yeni eklenecek', t.create],
        ['Okunma bilgisi güncellenecek', t.update],
        ['Zaten kayıtlı', t.unchanged],
      ])}</div>`;
      if (t.unreadableDates) html += `<div class="box warn">${t.unreadableDates} satırın tarihi okunamadı (atlandı).</div>`;
    }
  }

  if (b && b.tablesUsed) {
    if (b.needsWorkplace) {
      html += `<div class="box warn"><b>e-Bildirge</b><br>Belgelerin hangi işyerine ait olduğu sayfadan anlaşılamadı. İşyeri sicil numarasını girin:
        <input id="registryNo" inputmode="numeric" placeholder="26 haneli işyeri sicil no" style="margin-top:6px" />
        <button id="retryRegistry" class="ghost">Önizlemeyi yenile</button></div>`;
    } else {
      writes += b.create + b.update;
      html += `<div class="box info"><b>e-Bildirge</b>${b.workplace ? `<br><span class="muted">${esc(b.workplace.company)}</span>` : ''}${table([
        ['Tanınan belge', b.recognized],
        ['Yeni eklenecek', b.create],
        ['Güncellenecek', b.update],
        ['Zaten kayıtlı', b.unchanged],
      ])}</div>`;
    }
    if (b.unreadablePeriods.length) html += `<div class="box warn">Okunamayan dönemler: ${b.unreadablePeriods.slice(0, 5).map(esc).join('; ')}</div>`;
    if (b.unmatchedRegistries.length)
      html += `<div class="box warn">Portalda kayıtlı olmayan işyeri sicil no (${b.unmatchedRegistries.length}): ${b.unmatchedRegistries.slice(0, 5).map(esc).join(', ')}</div>`;
  }

  const unmatched = [...new Set([...(d.unmatchedTaxNumbers || []), ...(t.unmatchedTaxNumbers || [])])];
  if (unmatched.length)
    html += `<div class="box warn">Portalda kayıtlı olmayan VKN/TCKN (${unmatched.length}): ${unmatched.slice(0, 8).map(esc).join(', ')}${unmatched.length > 8 ? '…' : ''}</div>`;

  if (!d.tablesUsed && !t.tablesUsed && !(b && b.tablesUsed)) {
    const seen = (d.ignoredTableHeaders || []).map((h) => esc(h.join(' | '))).join('<br>');
    html += `<div class="box err">Bu sayfada beyanname, tebligat veya e-Bildirge listesi bulunamadı.${seen ? `<br><span class="muted">Görülen başlıklar:<br>${seen}</span>` : ''}</div>`;
  }

  $('preview').innerHTML = html;
  $('preview').hidden = false;
  $('commit').hidden = writes === 0;
  $('commit').textContent = `Aktar (${writes} kayıt)`;

  const retry = document.getElementById('retry');
  if (retry)
    retry.addEventListener('click', async () => {
      const v = document.getElementById('taxNumber').value.replace(/\D/g, '');
      if (v.length !== 10 && v.length !== 11) return show('err', 'VKN 10, TCKN 11 haneli olmalı.');
      state.taxNumber = v;
      try {
        renderPreview(await callImport(true));
      } catch (e) {
        show('err', esc(e.message));
      }
    });

  const retryRegistry = document.getElementById('retryRegistry');
  if (retryRegistry)
    retryRegistry.addEventListener('click', async () => {
      const v = document.getElementById('registryNo').value.trim();
      if (v.replace(/\D/g, '').length < 20) return show('err', 'İşyeri sicil no en az 20 rakam olmalı.');
      state.registryNo = v;
      try {
        renderPreview(await callImport(true));
      } catch (e) {
        show('err', esc(e.message));
      }
    });
}

async function readPage() {
  show('', '');
  $('preview').hidden = true;
  $('commit').hidden = true;
  state.taxNumber = '';
  state.registryNo = '';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !isAllowedPage(tab.url || '')) {
    return show('err', 'Sadece GİB (gib.gov.tr) ve SGK (sgk.gov.tr) sayfalarında çalışır. Önce e-Beyanname, e-Tebligat veya e-Bildirge listesini açın.');
  }
  $('read').disabled = true;
  try {
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['extract.js'] });
    // Çerçeveli sayfalarda her çerçevenin tabloları birleştirilir
    const frames = results.map((r) => r.result).filter(Boolean);
    state.page = {
      url: tab.url,
      tables: frames.flatMap((f) => f.tables),
      registryHints: [...new Set(frames.flatMap((f) => f.registryHints || []))].slice(0, 20),
    };
    if (!state.page.tables.length) return show('err', 'Bu sayfada tablo bulunamadı. Beyanname, tebligat veya bildirge listesinin göründüğünden emin olun.');
    renderPreview(await callImport(true));
  } catch (e) {
    show('err', esc(e.message));
  } finally {
    $('read').disabled = false;
  }
}

async function commit() {
  $('commit').disabled = true;
  try {
    const r = await callImport(false);
    $('preview').hidden = true;
    $('commit').hidden = true;
    const d = r.declarations, t = r.tebligat, b = r.ebildirge;
    show('ok', `Aktarıldı. Beyanname: ${d.create} yeni, ${d.replaceManual + d.complete} güncellendi. Tebligat: ${t.create} yeni, ${t.update} güncellendi. e-Bildirge: ${b.create} yeni, ${b.update} güncellendi.`);
  } catch (e) {
    show('err', esc(e.message));
  } finally {
    $('commit').disabled = false;
  }
}

$('save').addEventListener('click', save);
$('read').addEventListener('click', readPage);
$('commit').addEventListener('click', commit);
$('openSettings').addEventListener('click', () => {
  $('settings').hidden = false;
  $('main').hidden = true;
});
load();
