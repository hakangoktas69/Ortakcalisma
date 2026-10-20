"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { api, companyTypeLabel, type Company, type CompanyType, type Me } from "@/lib/api";
import CompanyImportModal from "./CompanyImportModal";

const emptyForm = { title: "", taxNumber: "", type: "SIRKET" as CompanyType, taxOffice: "" };

export default function CompaniesPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [items, setItems] = useState<Company[]>([]);
  const [q, setQ] = useState(initialQuery);
  const [type, setType] = useState<"" | CompanyType>("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Me>("/auth/me").then((m) => alive && setIsAdmin(m.role === "ADMIN")).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    api<Company[]>(`/companies?${params}`).then(setItems).catch((e) => setError(e.message));
  }, [q, type]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api<Company>("/companies", {
        method: "POST",
        body: JSON.stringify({ ...form, taxOffice: form.taxOffice || undefined }),
      });
      setForm(emptyForm);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız");
    }
  }

  async function toggleActive(c: Company) {
    await api(`/companies/${c.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !c.isActive }) });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Firmalarım</h1>
        <div className="flex gap-2">
        {isAdmin && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50"
          >
            <FileUp size={16} /> Excel&apos;den aktar
          </button>
        )}
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> Yeni firma
        </button>
        </div>
      </div>
      {notice && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {showImport && (
        <CompanyImportModal
          onClose={() => setShowImport(false)}
          onDone={(m) => {
            setShowImport(false);
            setNotice(m);
            load();
          }}
        />
      )}

      {showForm && (
        <form onSubmit={create} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input
            required
            placeholder="Unvan / Ad Soyad"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
          />
          <input
            required
            placeholder="VKN / TCKN"
            inputMode="numeric"
            value={form.taxNumber}
            onChange={(e) => setForm({ ...form, taxNumber: e.target.value.replace(/\D/g, "").slice(0, 11) })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CompanyType })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {Object.entries(companyTypeLabel).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            placeholder="Vergi dairesi"
            value={form.taxOffice}
            onChange={(e) => setForm({ ...form, taxOffice: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 sm:col-span-2 lg:col-span-5">
            Kaydet
          </button>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Unvan veya VKN ile ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "" | CompanyType)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Tüm türler</option>
          {Object.entries(companyTypeLabel).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Unvan</th>
              <th className="px-4 py-3">VKN/TCKN</th>
              <th className="px-4 py-3">Tür</th>
              <th className="px-4 py-3">Vergi dairesi</th>
              <th className="px-4 py-3">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium">{c.title}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{c.taxNumber}</td>
                <td className="px-4 py-2.5">{companyTypeLabel[c.type]}</td>
                <td className="px-4 py-2.5">{c.taxOffice ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleActive(c)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                    }`}
                    title="Durumu değiştir"
                  >
                    {c.isActive ? "Aktif" : "Pasif"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Kayıt bulunamadı</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">{items.length} firma</p>
    </div>
  );
}
