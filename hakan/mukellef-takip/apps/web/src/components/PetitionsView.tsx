"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Printer, Save, Trash2 } from "lucide-react";
import { api, type Company, type PetitionTemplate, type PreparedPetition } from "@/lib/api";

interface PetitionListItem {
  id: string;
  title: string;
  createdAt: string;
  company: { id: string; title: string };
}

/** Sunucudaki kuralın aynısı: dolu değerleri yazar, boşları {{alan}} olarak bırakır. */
function fill(body: string, values: Record<string, string>) {
  return body.replace(/\{\{([a-z_]+)\}\}/g, (all, key: string) => (values[key]?.trim() ? values[key] : all));
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Dilekçeyi A4 düzeninde yeni pencerede açıp yazdırma penceresini başlatır (PDF olarak da kaydedilebilir). */
function printPetition(title: string, content: string) {
  const w = window.open("", "_blank", "noopener=no,width=800,height=1000");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>@page{size:A4;margin:25mm 20mm}body{font:12pt/1.6 "Times New Roman",serif;color:#000;white-space:pre-wrap}</style>
</head><body>${escapeHtml(content)}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
  return true;
}

export default function PetitionsView() {
  const [templates, setTemplates] = useState<PetitionTemplate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [history, setHistory] = useState<PetitionListItem[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [prepared, setPrepared] = useState<PreparedPetition | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadHistory = useCallback(() => api<PetitionListItem[]>("/petitions").then(setHistory), []);

  useEffect(() => {
    let alive = true;
    Promise.all([api<PetitionTemplate[]>("/petitions/templates"), api<Company[]>("/companies"), api<PetitionListItem[]>("/petitions")])
      .then(([t, c, h]) => {
        if (!alive) return;
        setTemplates(t);
        setCompanies(c.filter((x) => x.isActive));
        setHistory(h);
      })
      .catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, []);

  // Şablon ve firma seçilince otomatik alanlarla hazırla
  useEffect(() => {
    if (!templateId || !companyId) return;
    let alive = true;
    api<PreparedPetition>("/petitions/prepare", { method: "POST", body: JSON.stringify({ templateId, companyId }) })
      .then((p) => {
        if (!alive) return;
        setPrepared(p);
        setValues(Object.fromEntries(p.fields.map((f) => [f.key, f.value])));
        setEditing(false);
      })
      .catch((e) => alive && setMsg({ kind: "err", text: e.message }));
    return () => {
      alive = false;
    };
  }, [templateId, companyId]);

  const filled = useMemo(() => (prepared ? fill(prepared.body, values) : ""), [prepared, values]);
  const finalText = editing ? content : filled;
  const missing = useMemo(() => [...new Set([...finalText.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))], [finalText]);
  const missingLabels = missing.map((k) => prepared?.fields.find((f) => f.key === k)?.label ?? k);

  async function save() {
    if (!prepared) return;
    if (missing.length && !confirm(`Doldurulmamış alanlar var (${missingLabels.join(", ")}). Yine de kaydedilsin mi?`)) return;
    setMsg(null);
    try {
      await api("/petitions", {
        method: "POST",
        body: JSON.stringify({ companyId, templateId: prepared.templateId, title: prepared.title, content: finalText }),
      });
      await loadHistory();
      setMsg({ kind: "ok", text: "Dilekçe arşive kaydedildi." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  async function openFromHistory(id: string, print: boolean) {
    try {
      const p = await api<{ title: string; content: string }>(`/petitions/${id}`);
      if (print) {
        if (!printPetition(p.title, p.content)) setMsg({ kind: "err", text: "Açılır pencere engellendi; tarayıcıda izin verin." });
      } else {
        setPrepared(null);
        setTemplateId("");
        setEditing(true);
        setContent(p.content);
      }
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    }
  }

  async function removeFromHistory(item: PetitionListItem) {
    if (!confirm(`"${item.title}" (${item.company.title}) arşivden silinsin mi?`)) return;
    await api(`/petitions/${item.id}`, { method: "DELETE" }).catch((e) => setMsg({ kind: "err", text: e.message }));
    loadHistory();
  }

  const grouped = useMemo(() => {
    const g = new Map<string, PetitionTemplate[]>();
    templates.forEach((t) => g.set(t.category, [...(g.get(t.category) ?? []), t]));
    return [...g.entries()];
  }, [templates]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Dilekçeler</h1>
        <p className="text-xs text-slate-500">
          Şablonlar örnek metindir; göndermeden önce içeriği kendi durumunuza göre kontrol edip düzenleyin.
        </p>
      </div>
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-2 px-1 text-xs font-bold uppercase text-slate-500">Şablonlar</h2>
            {grouped.map(([cat, list]) => (
              <Fragment key={cat}>
                <p className="mt-2 px-1 text-[11px] font-semibold text-slate-400">{cat}</p>
                {list.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${templateId === t.id ? "bg-violet-50 font-semibold text-violet-800" : "hover:bg-slate-50"}`}
                  >
                    <FileText size={15} className="mt-0.5 shrink-0" /> {t.title}
                  </button>
                ))}
              </Fragment>
            ))}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="mb-2 px-1 text-xs font-bold uppercase text-slate-500">Arşiv</h2>
            {history.length === 0 && <p className="px-1 text-xs text-slate-500">Henüz kayıtlı dilekçe yok.</p>}
            <ul className="divide-y divide-slate-100">
              {history.slice(0, 15).map((p) => (
                <li key={p.id} className="flex items-center gap-1 py-1.5">
                  <button onClick={() => openFromHistory(p.id, false)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm">{p.title}</p>
                    <p className="truncate text-[11px] text-slate-500">
                      {p.company.title} · {new Date(p.createdAt).toLocaleDateString("tr-TR")}
                    </p>
                  </button>
                  <button onClick={() => openFromHistory(p.id, true)} className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Yazdır">
                    <Printer size={14} />
                  </button>
                  <button onClick={() => removeFromHistory(p)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Sil">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">Şablon</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Seçin…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Firma</span>
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="">Seçin…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} · {c.taxNumber}</option>
                ))}
              </select>
            </label>
          </div>

          {prepared && !editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              {prepared.fields.map((f) => (
                <label key={f.key} className={`text-sm ${f.multiline ? "sm:col-span-2" : ""}`}>
                  <span className="font-medium">
                    {f.label}
                    {f.auto && <span className="ml-1 text-[10px] font-normal text-slate-400">(otomatik)</span>}
                  </span>
                  {f.multiline ? (
                    <textarea rows={5} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                  ) : (
                    <input value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                  )}
                </label>
              ))}
            </div>
          )}

          {(prepared || editing) && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{editing ? "Metin (düzenleniyor)" : "Önizleme"}</h2>
                {prepared && (
                  <button
                    onClick={() => {
                      if (!editing) setContent(filled);
                      setEditing(!editing);
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                  >
                    {editing ? "Alanlara dön (düzenlemeler silinir)" : "Metni serbestçe düzenle"}
                  </button>
                )}
              </div>
              {editing ? (
                <textarea rows={22} value={content} onChange={(e) => setContent(e.target.value)} className="w-full rounded-lg border border-slate-300 px-4 py-3 font-serif text-[15px] leading-relaxed" />
              ) : (
                <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-6 py-5 font-serif text-[15px] leading-relaxed">
                  {filled.split(/(\{\{[a-z_]+\}\})/g).map((part, i) =>
                    /^\{\{[a-z_]+\}\}$/.test(part) ? (
                      <mark key={i} className="rounded bg-amber-200 px-0.5">{part}</mark>
                    ) : (
                      <Fragment key={i}>{part}</Fragment>
                    ),
                  )}
                </div>
              )}
              {missing.length > 0 && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Doldurulmamış alanlar: {missingLabels.join(", ")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {prepared && (
                  <button onClick={save} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                    <Save size={16} /> Arşive kaydet
                  </button>
                )}
                <button
                  onClick={() => !printPetition(prepared?.title ?? "Dilekçe", finalText) && setMsg({ kind: "err", text: "Açılır pencere engellendi; tarayıcıda izin verin." })}
                  className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Printer size={16} /> Yazdır / PDF
                </button>
              </div>
            </>
          )}

          {!prepared && !editing && <p className="py-8 text-center text-sm text-slate-500">Başlamak için bir şablon ve firma seçin.</p>}
        </section>
      </div>
    </div>
  );
}
