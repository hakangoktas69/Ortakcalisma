"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { OfficeStatus } from "@/lib/api";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/format";

export const input =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
export const label = "mb-1 block text-sm font-medium text-slate-700";
export const btn =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
export const btnPrimary = `${btn} bg-brand-600 text-white hover:bg-brand-700`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnDanger = `${btn} border border-red-200 bg-white text-red-700 hover:bg-red-50`;
export const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";

export function StatusBadge({ status }: { status: OfficeStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Geçici şifre / kurtarma kodu gibi bir kez gösterilen değer: kopyalama düğmesiyle. */
export function SecretValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim yoksa kullanıcı elle seçer
    }
  };
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5">
      <code className="min-w-0 break-all font-mono text-base font-semibold tracking-wide text-slate-900">{value}</code>
      <button type="button" onClick={copy} className="shrink-0 rounded p-1 text-slate-600 hover:bg-amber-100" aria-label="Kopyala">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </span>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
