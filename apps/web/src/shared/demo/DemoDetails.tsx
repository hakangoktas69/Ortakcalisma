'use client';

import { useState } from 'react';
import { demoFirms, demoDocuments, planQueries, type DemoDocument, type DemoQuery } from './details.ts';
import { pdfDocument } from './model.ts';
import { DemoDeclarationDates } from './DemoDeclarationDates.tsx';

export function demoFile(doc: DemoDocument, mode: 'open' | 'download') {
  if (mode === 'open') { window.open(`${window.location.pathname}#demo-belge/${doc.id}`, '_blank', 'noopener,noreferrer'); return; }
  const url = URL.createObjectURL(new Blob([pdfDocument(`${doc.kind} / ${doc.firmId} / ${doc.period}`)], { type: 'application/pdf' }));
  const link = document.createElement('a'); link.href = url; link.download = doc.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function StateBadge({ value }: { value: string }) {
  return <span className={`demo-state ${value === 'Aktif' ? 'is-active' : value === 'Aktif değil' ? 'is-inactive' : ''}`}>{value}</span>;
}
export function DocumentList({ documents }: { documents: DemoDocument[] }) {
  return <div className="demo-document-list">{documents.length ? documents.map(doc => <article key={doc.id} className="demo-document"><div><strong>{doc.kind}</strong><p>{doc.period} · {doc.size} KB · {doc.name}</p></div><div className="demo-actions"><button type="button" className="dugme ikincil" onClick={() => demoFile(doc, 'open')} aria-label={`Aç · ${doc.kind} ${doc.period} örnek belge`}>Aç</button><button type="button" className="dugme birincil" onClick={() => demoFile(doc, 'download')} aria-label={`İndir · ${doc.kind} ${doc.period} örnek belge`}>İndir</button></div></article>) : <p>Seçilen firma ve dönemde örnek belge bulunmuyor.</p>}</div>;
}
export function DemoDocumentPreview({ doc }: { doc: DemoDocument }) {
  return <section className="kart demo-special" aria-label="Örnek belge önizlemesi"><p className="demo-notice">DEMO · RESMÎ BELGE DEĞİLDİR</p><h1>{doc.kind}</h1><p>{demoFirms.find(f => f.id === doc.firmId)?.name}</p><p>Dönem: <strong>{doc.period}</strong></p><p>Dosya adı: {doc.name}</p><div className="demo-document-sheet"><h2>Örnek belge içeriği</h2><p>Bu belge, Eworks demo ekranlarını denemek için hazırlanmıştır. Gerçek mükellef veya kurum bilgisi içermez.</p><p>{doc.kind} · {doc.period} · DEMO</p></div><div className="demo-actions"><button type="button" className="dugme birincil" onClick={() => demoFile(doc, 'download')}>Örnek PDF olarak indir</button><a className="dugme ikincil" href={typeof window === 'undefined' ? '/' : window.location.pathname}>Belge listesine dön</a></div></section>;
}
export function DemoTransfer({ kind }: { kind: 'levha' | 'beyanname' | 'sgk' }) {
  const [start, setStart] = useState('2026-07-22'); const [end, setEnd] = useState('2026-08-31');
  const [firms, setFirms] = useState(demoFirms.map(f => f.id)); const [queries, setQueries] = useState<DemoQuery[]>([]);
  const [documents, setDocuments] = useState<DemoDocument[]>([]); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [archiveFirm, setArchiveFirm] = useState('atlas'); const [archivePeriod, setArchivePeriod] = useState('');
  const [lastResult, setLastResult] = useState('');
  const kinds = kind === 'levha' ? ['Vergi levhası'] : kind === 'sgk' ? ['SGK tahakkuku', 'SGK hizmet listesi'] : ['Beyanname', 'Tahakkuk fişi'];
  const title = kind === 'levha' ? 'Vergi levhası' : kind === 'sgk' ? 'SGK belge' : 'Beyanname';
  const addDocs = (jobs: DemoQuery[]) => setDocuments(old => {
    const all = [...old, ...jobs.filter(q => q.state === 'Tamamlandı').flatMap(q => (q.periods ?? [q.start.slice(0, 7)]).flatMap(period => demoDocuments(q.firmId, period).filter(d => kinds.includes(d.kind))))];
    return [...new Map(all.map(d => [d.id, d])).values()];
  });
  const run = (periods: string[] | null = null) => {
    const plan: DemoQuery[] = planQueries(start, end, kind === 'beyanname' ? demoFirms.map(f => f.id) : firms).map(q => periods ? { ...q, periods } : q); if (!plan.length) { setMessage('Geçerli tarih sırası ve en az bir firma seçin. Aralık en fazla iki takvim yılına yayılabilir.'); return; }
    setBusy(true); setMessage('Demo sorguları hazırlanıyor; GİB/SGK bağlantısı kurulmaz.');
    setTimeout(() => { const next = plan.map((q, i) => ({ ...q, state: q.firmId === 'ornek' ? 'Sözleşme erişimi yok' : i === 0 ? 'Belge hatası' : 'Tamamlandı' })); setQueries(next); addDocs(next); setBusy(false); setLastResult(`Son tamamlanan demo sorgusu: ${start} – ${end}${periods ? ` · Dönem: ${periods[0]} – ${periods.at(-1)}` : ' · Yükleme zamanına göre'}`); setMessage('Örnek tarama bitti. Bir belge hatası ve kapsam dışı sözleşme senaryosu ayrı gösterildi; arşiv korunuyor.'); }, 450);
  };
  const retry = () => { const next = queries.map(q => q.state === 'Belge hatası' ? { ...q, state: 'Tamamlandı' } : q); setQueries(next); addDocs(next); setMessage('Örnek belge hatası giderildi. Aynı belge tekrar eklenmedi; sözleşme erişimi olmayan firmalar belge yok sayılmadı.'); };
  return <section className={kind === 'beyanname' ? 'demo-special' : 'kart demo-special'} aria-label={`${title} aktarım ve arşiv`}><h2 className={kind === 'beyanname' ? 'gorunmez' : undefined}>{title} aktarımı ve belge arşivi</h2><p>DEMO · Tarihler ve sonuçlar kurgusaldır. Önceki dönem belgeleri bu ekran açıkken korunur. Kalıcı kayıt yapılmaz.</p>
    {kind === 'beyanname' ? <DemoDeclarationDates start={start} end={end} busy={busy} lastResult={lastResult} canRetry={queries.some(q => q.state === 'Belge hatası')} onDatesChange={(from, to) => { setStart(from); setEnd(to); }} onRun={run} onRetry={retry} onLast={() => setMessage(queries.length ? `${queries.length} son örnek sorgu sonucu bu ekranda gösteriliyor; yeni sorgu başlatılmadı.` : 'Henüz bu ekranda tamamlanan bir demo sorgusu yok.')} /> : <><div className="demo-field-grid"><label>Tarama başlangıcı<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>Tarama bitişi<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label></div>
    <fieldset><legend>Taranacak örnek mükellefler</legend>{demoFirms.map(f => <label className="demo-check" key={f.id}><input type="checkbox" checked={firms.includes(f.id)} onChange={() => setFirms(old => old.includes(f.id) ? old.filter(id => id !== f.id) : [...old, f.id])} />{f.name}</label>)}</fieldset>
    <div className="demo-actions"><button className="dugme birincil" disabled={busy} onClick={() => run()}>Demo {kind === 'levha' ? 'levhaları çek' : 'taramayı başlat'}</button><button className="dugme ikincil" disabled={busy || !queries.some(q => q.state === 'Belge hatası')} onClick={retry}>Yalnız eksik belgeleri yeniden dene</button></div></>}
    <p role="status">{message}</p><div className="demo-summary"><span>Planlanan: {queries.length}</span><span>Tamamlanan: {queries.filter(q => q.state === 'Tamamlandı').length}</span><span>Belge hatası: {queries.filter(q => q.state === 'Belge hatası').length}</span><span>Erişim engeli: {queries.filter(q => q.state === 'Sözleşme erişimi yok').length}</span><span>Arşiv: {documents.length} örnek PDF</span></div>
    {queries.length ? <details><summary>Firma ve tarih bazında tarama sonuçları</summary>{queries.map(q => <p key={q.id}>{demoFirms.find(f => f.id === q.firmId)?.name} · {q.start} – {q.end} · <strong>{q.state}</strong></p>)}</details> : null}
    <div className="demo-field-grid"><label>Belge arşivi mükellefi<select value={archiveFirm} onChange={e => setArchiveFirm(e.target.value)}>{demoFirms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Belge arşivi dönemi<select value={archivePeriod} onChange={e => setArchivePeriod(e.target.value)}><option value="">Tüm dönemler</option>{[...new Set(documents.map(d => d.period))].sort().map(p => <option key={p}>{p}</option>)}</select></label></div>
    <DocumentList documents={documents.filter(d => d.firmId === archiveFirm && (!archivePeriod || d.period === archivePeriod))} />
  </section>;
}

export function DemoArchive({ kind }: { kind: 'sgk' | 'beyanname' }) {
  const [firm, setFirm] = useState('atlas'); const [period, setPeriod] = useState('2026-09');
  const kinds = kind === 'sgk' ? ['SGK tahakkuku', 'SGK hizmet listesi'] : ['Beyanname', 'Tahakkuk fişi'];
  return <section className="kart demo-special" aria-label="Dönem bazında kayıtlı belgeler"><h2>Dönem bazında kayıtlı örnek belgeler</h2><div className="demo-field-grid"><label>Belge sahibi firma<select value={firm} onChange={e => setFirm(e.target.value)}>{demoFirms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Belge dönemi<select value={period} onChange={e => setPeriod(e.target.value)}>{['2026-09', '2026-08', '2026-07'].map(p => <option key={p}>{p}</option>)}</select></label></div>
    {kind === 'sgk' ? <p><strong>Çalışan sayısı: {firm === 'atlas' ? 7 : firm === 'mavi' ? 12 : 0}</strong> · Örnek işyeri sicili: DEMO-ISYERI · Kaynak senaryosu: MUHSGK · Gerçek çalışan bilgisi değildir.</p> : <p>Örnek kaynak durumları: Onaylandı · Onaylandı İHB · İptal. Dosyalar firma, dönem ve belge türüyle ayrılır.</p>}
    <DocumentList documents={demoDocuments(firm, period).filter(d => kinds.includes(d.kind))} />
  </section>;
}

export function DemoShortcuts() {
  const [firm, setFirm] = useState(''); const [group, setGroup] = useState('GİB'); const [target, setTarget] = useState('');
  return <section className="kart demo-special" aria-label="Mükellefe özel portal kısayolları"><h2>Mükellefe özel portal kısayolları</h2><label>Portal için mükellef seç<select value={firm} onChange={e => { setFirm(e.target.value); setTarget(''); }}><option value="">Mükellef seçin</option>{demoFirms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><div className="demo-actions">{['GİB', 'SGK'].map(g => <button key={g} className="dugme ikincil" aria-pressed={group === g} onClick={() => { setGroup(g); setTarget(''); }}>{g} işlemleri</button>)}</div>
    <div className="demo-actions">{(group === 'GİB' ? ['Dijital Vergi Dairesi', 'e-Beyanname', 'e-Defter', 'e-Tebligat', 'Vergi levhası'] : ['e-Bildirge', 'İşe giriş çıkış', 'e-Rapor']).map(t => <button key={t} className="dugme birincil" disabled={!firm} onClick={() => setTarget(t)}>{t} önizlemesi</button>)}</div>
    {target ? <p role="status">{demoFirms.find(f => f.id === firm)?.name} için {target} seçildi. Demo oturum önizlemesi hazır. Gerçek kurum sayfası açılmadı, şifre kullanılmadı.</p> : <p>Mükellef ve işlem seçin. Bu ekranda yalnız akış canlandırılır.</p>}
    {group === 'GİB' ? <DemoTransfer kind="levha" /> : null}
  </section>;
}
