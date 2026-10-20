"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CHANGELOG, CHANGE_KIND_LABEL, type ChangeKind } from "@/content/changelog";
import { markChangesSeen } from "./shell/changelog-seen";

const KIND_CLASS: Record<ChangeKind, string> = {
  new: "bg-brand-50 text-brand-700",
  improved: "bg-sky-50 text-sky-700",
  fixed: "bg-amber-50 text-amber-800",
};

const formatDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function ChangelogView() {
  // Sayfa açıldığında yenilikler görülmüş sayılır; menüdeki işaret söner
  useEffect(() => {
    markChangesSeen();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Yenilikler</h1>
        <p className="mt-1 text-sm text-slate-600">Portala eklenen özellikler ve düzeltmeler, en yenisi üstte.</p>
      </div>

      <ol className="relative ml-1.5 space-y-8 border-l border-slate-200 pl-7">
        {CHANGELOG.map((entry, i) => (
          <li key={entry.id} className="relative">
            <span
              className={`absolute top-1.5 -left-[33px] size-3 rounded-full ring-4 ring-slate-50 ${i === 0 ? "bg-brand-600" : "bg-slate-300"}`}
              aria-hidden
            />
            <p className="text-xs font-semibold text-slate-500">
              <time dateTime={entry.date}>{formatDay(entry.date)}</time>
              {i === 0 && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">En yeni</span>}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">{entry.title}</h2>
            <p className="text-sm text-slate-600">{entry.summary}</p>
            <ul className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {entry.changes.map((c) => (
                <li key={c.text} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 w-[84px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-semibold ${KIND_CLASS[c.kind]}`}>
                    {CHANGE_KIND_LABEL[c.kind]}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-700">
                    {c.text}
                    {c.href && (
                      <Link href={c.href} className="ml-1.5 inline-flex items-center text-brand-700 hover:underline" aria-label={`${entry.title}: sayfaya git`}>
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
