'use client';
import { referencePage } from './referenceDesign.ts';
import { DemoReferenceRecords, DemoReferenceStats, DemoReferenceOverlay } from './DemoReferenceRecords.tsx';
import { DemoFirmDetails } from './DemoFirms.tsx';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DEMO_FIRMS, DEMO_PERIODS, csvDocument, filterRows, nextDemoId, pdfDocument, sampleRows, type DemoAction, type DemoPage, type DemoRow } from './model.ts';
import { demoHomeCards } from './catalog.ts';
import { DemoCards, demoIcon } from './DemoCards.tsx';
import { Simge } from '../ui/Simge.tsx';
import { DemoTransfer, DemoArchive, DemoShortcuts, DemoDocumentPreview } from './DemoDetails.tsx';
import { DemoLedger } from './DemoCalendarLedger.tsx';
import { DemoCalendar } from './DemoCalendar.tsx';
import { demoDocuments, demoFirms, type DemoDocument } from './details.ts';

const money = (amount: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
const isRow = (value: unknown): value is DemoRow => {
  if (!value || typeof value !== 'object') return false;
  return 'id' in value && typeof value.id === 'string' && value.id.startsWith('demo-') &&
    'firm' in value && typeof value.firm === 'string' && DEMO_FIRMS.includes(value.firm) &&
    'title' in value && typeof value.title === 'string' && value.title.length <= 160 &&
    'period' in value && typeof value.period === 'string' && DEMO_PERIODS.includes(value.period) &&
    'date' in value && typeof value.date === 'string' && 'status' in value && typeof value.status === 'string' &&
    'amount' in value && typeof value.amount === 'number' && Number.isFinite(value.amount) &&
    'employees' in value && typeof value.employees === 'number' &&
    'note' in value && typeof value.note === 'string' && value.note.length <= 1000;
};

function download(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Demo sunumu: tüm etkileşimler bu sekmenin belleği/sessionStorage'ında kalır; API veya kurum çağrısı yoktur. */
export function DemoWorkspace({ page, pages, namespace }: { page: DemoPage; pages: DemoPage[]; namespace: string }) {
  const [rows, setRows] = useState<DemoRow[]>(() => sampleRows(page.key));
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [firm, setFirm] = useState('');
  const [period, setPeriod] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<DemoRow | null>(null);
  const [editing, setEditing] = useState<DemoRow | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DemoDocument | null>(null);
  const [reset, setReset] = useState(0);
  const detailsRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLInputElement>(null);
  const storageKey = `eworks-demo-v1:${namespace}:${page.key}`;
  const reference = referencePage(page.key);
  const module = page.key.split('.')[0] ?? '';
  const monetary = ['beyanname', 'sgk', 'faturalar', 'odeme', 'raporlar'].includes(module);
  const specialized = ['firmalar.liste', 'firmalar.kart', 'firmalar.kurum_hesaplari', 'genel_bakis.takvim', 'edefter.liste', 'kisayollar'].includes(page.key);

  useEffect(() => {
    const hash = window.location.hash;
    const match = /^#demo-belge\/([a-z]+)-(\d{4}-\d{2})-([0-7])$/.exec(hash);
    if (!match || !demoFirms.some(f => f.id === match[1]) || !/^202[4-7]-(0[1-9]|1[0-2])$/.test(match[2] ?? '')) return;
    const doc = demoDocuments(match[1] ?? '', match[2] ?? '')[Number(match[3])];
    if (doc) setPreview(doc);
  }, []);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : null;
      if (Array.isArray(parsed) && parsed.length <= 100 && parsed.every(isRow)) setRows(parsed);
    } catch { setMessage('Bu sekmede kayıt saklama kullanılamıyor; demo bellekte çalışmaya devam ediyor.'); }
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(rows)); }
    catch { setMessage('Değişiklik bu sayfada uygulandı; sekme depolaması kullanılamıyor.'); }
  }, [ready, rows, storageKey]);
  useEffect(() => { if (detail) detailsRef.current?.focus(); }, [detail]);
  useEffect(() => { if (editing) formRef.current?.focus(); }, [editing]);

  const filtered = filterRows(rows, { search, firm, period, status });
  const canEdit = page.actions.some(a => /\.(edit|create|edit_credentials|edit_permissions|invite|ask)$/.test(a.key));
  const hasPdf = ['beyanname', 'sgk', 'edefter', 'dilekceler', 'faturalar', 'raporlar'].includes(module);
  const onDetail = (row: DemoRow) => { setDetail(row); setEditing(null); };
  const onAction = (action: DemoAction) => {
    const kind = action.key.split('.').at(-1);
    if (kind === 'view' || kind === 'view_status' || kind === 'review') {
      if (filtered[0]) onDetail(filtered[0]);
      else setMessage('İncelenecek kayıt yok. Filtreleri temizleyebilirsiniz.');
    } else if (kind === 'download' || kind === 'export') {
      if (!filtered.length) { setMessage('İndirilecek kayıt yok. Filtreleri temizleyin.'); return; }
      download(kind === 'download' ? pdfDocument(page.title) : csvDocument(filtered), `demo-${module}.${kind === 'download' ? 'pdf' : 'csv'}`, kind === 'download' ? 'application/pdf' : 'text/csv;charset=utf-8');
      setMessage('Örnek dosya hazırlandı. Dosya gerçek kurum verisi içermez.');
    } else if (['create', 'edit', 'edit_credentials', 'edit_permissions', 'invite', 'ask', 'remind'].includes(kind ?? '')) {
      setEditing(kind === 'edit' || kind === 'edit_credentials' || kind === 'edit_permissions' ? filtered[0] ?? 'new' : 'new'); setDetail(null);
    } else if (kind === 'sync' || kind === 'start') {
      setBusy(true);
      setMessage('Örnek aktarım hazırlanıyor; gerçek kuruma bağlanılmıyor.');
      // Yalnız görsel ilerleme: ağ isteği ve zamanlanmış kurum işi oluşturulmaz.
      setTimeout(() => {
        setRows(old => old.map(r => ({ ...r, status: 'Tamamlandı' })));
        setBusy(false); setMessage('Demo aktarımı tamamlandı. Yalnız örnek kayıtlar güncellendi.');
      }, 450);
    } else {
      setRows(old => old.map(r => ({ ...r, status: kind === 'cancel' ? 'Bekliyor' : 'Tamamlandı' })));
      setMessage(`${action.title} demo olarak uygulandı. Gerçek hesap, izin, ödeme veya kurum kaydı değiştirilmedi.`);
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') ?? '').trim();
    if (!title || title.length > 160) { setMessage('Açıklama 1–160 karakter olmalı.'); return; }
    if (editing === 'new' && rows.length >= 100) { setMessage('Demo sınırı 100 kayıttır. Örnekleri yenileyebilirsiniz.'); return; }
    const selectedFirm = String(data.get('firm'));
    const selectedPeriod = String(data.get('period'));
    if (!DEMO_FIRMS.includes(selectedFirm) || !DEMO_PERIODS.includes(selectedPeriod)) return;
    const amount = Number(data.get('amount'));
    if (!Number.isFinite(amount) || amount < 0) { setMessage('Tutar sıfır veya pozitif sayı olmalı.'); return; }
    const value: DemoRow = { id: editing && editing !== 'new' ? editing.id : nextDemoId(rows, page.key),
      firm: selectedFirm, title, period: selectedPeriod, date: `${selectedPeriod}-15`,
      status: String(data.get('status') ?? 'Bekliyor'), amount, employees: editing && editing !== 'new' ? editing.employees : 0,
      note: String(data.get('note') ?? '').trim().slice(0, 1000) };
    setRows(old => editing === 'new' ? [value, ...old] : old.map(r => r.id === value.id ? value : r));
    setEditing(null); setMessage('Demo kaydı bu sekmeye kaydedildi. Sunucuya veya kuruma gönderilmedi.');
  };

  if (preview) return <DemoDocumentPreview doc={preview} />;
  return <section className={`demo-workspace${reference ? " demo-reference" : ""}`} data-demo-page={page.key}>
    <p className={`demo-notice${page.key === 'genel_bakis.panel' ? ' demo-notice-compact' : ''}`}><strong>DEMO · Tamamen kurgusal veriler</strong><span>{page.key === 'genel_bakis.panel' ? 'Örnek verilerle çalışıyorsunuz. Gerçek kurum işlemi yapılmaz.' : 'Gerçek firma bilgisi girmeyin. İşlemler yalnız bu sekmede canlandırılır; GİB/SGK, ödeme ve ileti gönderimi yapılmaz.'}</span></p>
    {page.key !== 'genel_bakis.panel' ? <div className="donus"><Link className="dugme ikincil" href="/">← Ana sayfa</Link></div> : null}
    {page.key === 'genel_bakis.panel' ? <>
      <div className="hub-baslik"><span className="hub-ust">Eworks çalışma alanı</span><h1>İşlerinizi tek merkezden yönetin</h1><p>Başlamak için bir bölüm seçin.</p></div>
      <DemoCards cards={demoHomeCards(pages)} label="Ana sayfa kategorileri" large />
    </> : <>
      {!['genel_bakis.takvim', 'firmalar.liste'].includes(page.key) ? <div className="baslik"><div><p className="ust-satir">Eworks / Demo çalışma alanı</p><h1>{page.title}</h1><p className="alt">Örnek kayıtları inceleyin ve işlemleri güvenle deneyin.</p></div>
        <button className="dugme ikincil" disabled={!ready || busy} onClick={() => { setRows(sampleRows(page.key)); setReset(n => n + 1); setMessage('Bu sayfanın örnek kayıtları başlangıç durumuna döndü.'); setDetail(null); setEditing(null); }}><Simge ad="grid" />Örnekleri yenile</button>
      </div> : null}
      {page.key !== 'genel_bakis.takvim' ? <nav aria-label="Bölüm sayfaları" className="demo-tabs">{pages.filter(p => p.key.split('.')[0] === module).map(p => <Link key={p.key} href={p.path} aria-current={p.key === page.key ? 'page' : undefined}><Simge ad={demoIcon(p.path)} />{p.title}</Link>)}</nav> : null}
      <div key={reset} className="demo-special-container">
      {['firmalar.liste', 'firmalar.kart', 'firmalar.kurum_hesaplari'].includes(page.key) ? <DemoFirmDetails primary={page.key === 'firmalar.liste'} /> : null}
      {page.key === 'kisayollar' ? <DemoShortcuts /> : null}
      {page.key === 'genel_bakis.takvim' ? <DemoCalendar /> : null}
      {['beyanname.liste', 'beyanname.senkron'].includes(page.key) ? <DemoTransfer kind="beyanname" /> : null}
      {['beyanname.liste', 'beyanname.belge'].includes(page.key) ? <DemoArchive kind="beyanname" /> : null}
      {page.key === 'sgk.ebildirge' ? <><DemoArchive kind="sgk" /><DemoTransfer kind="sgk" /></> : null}
      {module === 'edefter' ? <DemoLedger /> : null}
      </div>
      {!specialized ? <>{reference ? <DemoReferenceStats rows={filtered} /> : <div className="demo-metrics"><div className="kart"><span>Örnek kayıt</span><strong>{rows.length}</strong></div><div className="kart"><span>Görüntülenen</span><strong>{filtered.length}</strong></div><div className="kart"><span>Örnek firmalar</span><strong>{new Set(rows.map(r => r.firm)).size}</strong></div></div>}
      <div className="kart demo-filters"><label>Firma veya açıklama ara<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Örneğin: Mavi İnşaat" /></label>
        <label>Firma<select value={firm} onChange={e => setFirm(e.target.value)}><option value="">Tüm firmalar</option>{DEMO_FIRMS.map(f => <option key={f}>{f}</option>)}</select></label>
        <label>Dönem<select value={period} onChange={e => setPeriod(e.target.value)}><option value="">Tüm dönemler</option>{DEMO_PERIODS.map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Durum<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tüm durumlar</option>{['Tamamlandı', 'Bekliyor', 'Kontrol gerekli'].map(s => <option key={s}>{s}</option>)}</select></label>
        <button className="dugme ikincil" onClick={() => { setSearch(''); setFirm(''); setPeriod(''); setStatus(''); }}>Filtreleri temizle</button>
      </div>
      <div className="demo-actions" aria-label="Demo işlemleri" aria-busy={busy}>{page.actions.map(a => <button key={a.key} className="dugme birincil" disabled={busy || !ready} onClick={() => onAction(a)}>{a.title}</button>)}</div>
      {module === 'destek' && page.key.endsWith('.sss') ? <div className="kart">{['Demo verileri gerçek mi?', 'Gerçek entegrasyona nasıl geçilir?', 'Demo kayıtları nerede tutulur?'].map((q, i) => <details key={q}><summary>{q}</summary><p>{['Hayır. Firmalar, tutarlar ve belgeler tamamen örnektir.', 'Gerçek bağlantılar ayrı geliştirme ve canlı doğrulama sürecinde uygulanır. Demo ortamı gerçek kurum kullanmaz.', 'Değişiklikler yalnız bu tarayıcı sekmesinde tutulur. Sekmeyi kapatınca kaybolur; örnekleri yenileyebilirsiniz.'][i]}</p></details>)}</div> : null}
      {!filtered.length ? <div className="kart"><h2>Kayıt bulunamadı</h2><p>Arama veya dönem filtrelerini değiştirin. Demo kayıtlarını tekrar oluşturmak için “Örnekleri yenile”yi kullanabilirsiniz.</p></div> : reference ? <DemoReferenceRecords rows={filtered} title={page.title} employees={module === 'sgk'} monetary={monetary} onDetail={onDetail} /> : <div className="demo-records" aria-label="Örnek kayıtlar">{filtered.map(row => <article className="kart demo-record" key={row.id}>
        <div><p className="demo-firm">{row.firm}</p><h2>{row.title}</h2><p className="soluk">Dönem: <strong>{row.period}</strong> · Kayıt: {row.date}</p><p className="soluk">{module === 'sgk' ? `${row.employees} çalışan · ` : ''}{monetary ? `${money(row.amount)} · ` : ''}Örnek veri</p></div>
        <div className="demo-record-actions"><span className={`rozet ${row.status === 'Tamamlandı' ? 'yesil' : ''}`}>{row.status}</span><button className="dugme ikincil" onClick={() => onDetail(row)} aria-label={`${row.firm} ${row.period} detay`}>Detay</button></div>
      </article>)}</div>}</> : null}
    </>}
    <p role="status" aria-live="polite" className={message ? 'basari' : 'demo-status'}>{message || (ready ? 'Demo hazır. Tüm kayıtlar kurgusaldır.' : 'Örnek kayıtlar hazırlanıyor…')}</p>
    {detail ? <DemoReferenceOverlay enabled={reference} title="Kayıt detayı" close={() => setDetail(null)}><section className="kart demo-detail" ref={detailsRef} tabIndex={-1} aria-label="Kayıt detayı" onKeyDown={e => { if (e.key === 'Escape') setDetail(null); }}>
      <h2>Kayıt detayı</h2><dl><dt>Firma</dt><dd>{detail.firm}</dd><dt>Açıklama</dt><dd>{detail.title}</dd><dt>Dönem</dt><dd>{detail.period}</dd><dt>Durum</dt><dd>{detail.status}</dd><dt>Not</dt><dd>{detail.note}</dd></dl>
      {module === 'tebligat' ? <p className="uyari">Yalnız liste bilgisi canlandırılır. Tebligat belgesi açılmaz ve okundu işlemi uygulanmaz.</p> : null}
      {module === 'kisayollar' ? <p className="uyari">Bu demo kısayol önizlemesidir. Gerçek kurum sayfası açılmadı ve giriş yapılmadı.</p> : null}
      <div className="demo-actions">{hasPdf ? <button className="dugme birincil" onClick={() => download(pdfDocument(`${detail.title} - ${detail.period}`), `demo-${module}-${detail.period}.pdf`, 'application/pdf')}>Örnek PDF indir</button> : null}
        {canEdit ? <button className="dugme ikincil" onClick={() => { setEditing(detail); setDetail(null); }}>Kaydı düzenle</button> : null}
        <button className="dugme ikincil" onClick={() => setDetail(null)}>Detayı kapat</button></div>
    </section></DemoReferenceOverlay> : null}
    {editing ? <DemoReferenceOverlay enabled={reference} title="Demo kayıt formu" close={() => setEditing(null)}><section className="kart demo-detail" aria-label="Demo kayıt formu"><h2>{editing === 'new' ? 'Yeni demo kaydı' : 'Demo kaydını düzenle'}</h2>
      <p className="uyari">Gerçek kimlik, şifre, hesap veya kişi bilgisi yazmayın. Bu form gerçek işlem yapmaz.</p>
      <form className="form" onSubmit={save}><label>Açıklama<input ref={formRef} name="title" required maxLength={160} defaultValue={editing === 'new' ? '' : editing.title} /></label>
        <div className="form-satir"><label>Örnek firma<select name="firm" defaultValue={editing === 'new' ? DEMO_FIRMS[0] : editing.firm}>{DEMO_FIRMS.map(f => <option key={f}>{f}</option>)}</select></label>
        <label>Örnek dönem<select name="period" defaultValue={editing === 'new' ? DEMO_PERIODS[0] : editing.period}>{DEMO_PERIODS.map(p => <option key={p}>{p}</option>)}</select></label>
        {monetary ? <label>Örnek tutar<input name="amount" type="number" min="0" step="0.01" required defaultValue={editing === 'new' ? 0 : editing.amount} /></label> : <input name="amount" type="hidden" value="0" />}
        <label>Örnek durum<select name="status" defaultValue={editing === 'new' ? 'Bekliyor' : editing.status}>{['Bekliyor', 'Tamamlandı', 'Kontrol gerekli'].map(s => <option key={s}>{s}</option>)}</select></label></div>
        <label>Demo notu<textarea name="note" maxLength={1000} defaultValue={editing === 'new' ? '' : editing.note} /></label>
        <div className="demo-actions"><button className="dugme birincil" type="submit">Demo kaydını kaydet</button><button className="dugme ikincil" type="button" onClick={() => setEditing(null)}>Vazgeç</button></div>
      </form></section></DemoReferenceOverlay> : null}
  </section>;
}
