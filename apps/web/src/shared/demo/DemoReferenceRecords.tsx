'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Simge } from '../ui/Simge.tsx';
import { referenceDate, referenceStats } from './referenceDesign.ts';
import type { DemoRow } from './model.ts';

export function DemoReferenceStats({ rows }: { rows: DemoRow[] }) {
  const counts = referenceStats(rows);
  return <section className="dr-stats" aria-label="Kayıt özeti">{(['Toplam kayıt', 'Tamamlanan', 'İşlem bekleyen', 'Dikkat gerektiren'] as const).map((label, i) => <article className="kart" key={label}><div><span>{label}</span><strong>{counts[i]}</strong></div><span className="dr-stat-icon"><Simge ad={(['file', 'check', 'clock', 'bell'] as const)[i] ?? 'file'} /></span></article>)}</section>;
}
export function DemoReferenceRecords({ rows, title, employees, monetary, onDetail }: { rows: DemoRow[]; title: string; employees: boolean; monetary: boolean; onDetail: (row: DemoRow) => void }) {
  return <section className="kart dr-records" aria-label="Örnek kayıtlar"><header><strong>{title} kayıtları</strong><span>{rows.length} kayıt listeleniyor · Detay düğmesinden inceleyin</span></header><table className="dr-table"><caption className="gorunmez">{title} örnek kayıtları</caption><thead><tr>{['İşlem / Belge', 'Mükellef / Şirket', 'Dönem', 'Oluşturma', ...(employees ? ['Çalışan sayısı'] : monetary ? ['Tutar'] : []), 'Durum', 'İşlem'].map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="demo-record dr-record" key={row.id}><td data-label="İşlem / Belge"><h2>{row.title}</h2><small>{row.id}</small></td><td data-label="Mükellef / Şirket"><strong>{row.firm}</strong><small>Örnek mükellef</small></td><td data-label="Dönem">{row.period}</td><td data-label="Oluşturma">{referenceDate(row.date)}</td>{employees ? <td data-label="Çalışan sayısı"><span className="dr-employee">{row.employees} çalışan</span></td> : monetary ? <td data-label="Tutar"><strong>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(row.amount)}</strong></td> : null}<td data-label="Durum"><span className={`dr-badge ${row.status === 'Tamamlandı' ? 'complete' : row.status === 'Bekliyor' ? 'pending' : 'attention'}`}>{row.status}</span></td><td data-label="İşlem"><button className="dr-detail" onClick={() => onDetail(row)} aria-label={`${row.firm} ${row.period} detay`}>Detay <span aria-hidden="true">→</span></button></td></tr>)}</tbody></table></section>;
}

export function DemoReferenceOverlay({ enabled, title, close, children }: { enabled: boolean; title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (enabled) ref.current?.showModal(); }, [enabled]);
  if (!enabled) return <>{children}</>;
  return <dialog ref={ref} className="dr-drawer" aria-label={title} onCancel={close}><button className="dugme ikincil dr-drawer-close" aria-label="Paneli kapat" onClick={close}>Kapat ×</button>{children}</dialog>;
}
