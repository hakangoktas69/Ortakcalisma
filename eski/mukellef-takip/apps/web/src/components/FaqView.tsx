"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Search, Sparkles } from "lucide-react";
import { FAQ, type FaqItem } from "@/content/faq";

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Şifre" → "sifre" */
const fold = (s: string) =>
  s
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]!);

function Answer({ item }: { item: FaqItem }) {
  // Ardışık "- " satırları tek listede toplanır
  const blocks: (string | string[])[] = [];
  for (const line of item.a) {
    if (line.startsWith("- ")) {
      const last = blocks.at(-1);
      if (Array.isArray(last)) last.push(line.slice(2));
      else blocks.push([line.slice(2)]);
    } else blocks.push(line);
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
      {blocks.map((b, i) =>
        Array.isArray(b) ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.map((li) => (
              <li key={li}>{li}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b}</p>
        ),
      )}
      {item.link && (
        <Link href={item.link.href} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
          {item.link.label} sayfasına git <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

export default function FaqView() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>("");
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  // Bağlantıyla gelinirse (/sss#iki-adim) o soru açık gelir
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id || !FAQ.some((s) => s.items.some((i) => i.id === id))) return;
    const t = setTimeout(() => {
      setOpen(new Set([id]));
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const q = fold(query.trim());
  const sections = useMemo(
    () =>
      FAQ.filter((s) => !section || s.id === section)
        .map((s) => ({ ...s, items: s.items.filter((i) => !q || fold(`${i.q} ${i.a.join(" ")}`).includes(q)) }))
        .filter((s) => s.items.length),
    [q, section],
  );
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Sıkça sorulan sorular</h1>
        <p className="mt-1 text-sm text-slate-600">Portalın kullanımı, veri güvenliği ve hesabınız hakkında.</p>
      </div>

      <div className="space-y-3">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-brand-400">
          <Search size={17} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Soru ara: şifre, fatura, bordro, eklenti…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            aria-label="Sorularda ara"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {[{ id: "", title: "Tümü" }, ...FAQ].map((s) => (
            <button
              key={s.id || "all"}
              onClick={() => setSection(s.id)}
              className={`rounded-full px-3 py-1 text-sm ${section === s.id ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center text-sm text-slate-600">
          &quot;{query}&quot; ile eşleşen soru bulunamadı.
        </div>
      )}

      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`sss-${s.id}`}>
          <h2 id={`sss-${s.id}`} className="mb-2 text-xs font-semibold tracking-widest text-slate-500 uppercase">
            {s.title}
          </h2>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {s.items.map((item) => {
              const isOpen = open.has(item.id) || (!!q && total <= 3);
              return (
                <div key={item.id} id={item.id} className="scroll-mt-20">
                  <button
                    onClick={() => toggle(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={`${item.id}-cevap`}
                    className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <span className="flex-1 text-[15px] font-semibold text-slate-900">{item.q}</span>
                    <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div id={`${item.id}-cevap`} className="px-5 pb-5">
                      <Answer item={item} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-900">
        <Sparkles size={18} className="shrink-0 text-brand-600" />
        <span className="flex-1">Sorunuz vergi veya SGK mevzuatıyla ilgiliyse Uzmana Sor&apos;a danışın.</span>
        <Link href="/asistan" className="font-semibold text-brand-700 hover:underline">
          Uzmana Sor
        </Link>
      </div>
    </div>
  );
}
