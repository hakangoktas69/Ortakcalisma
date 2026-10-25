"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { EyeOff, Link2, MessageSquarePlus, Send, ShieldCheck, Sparkles, Square, Trash2 } from "lucide-react";
import {
  api,
  apiStream,
  type AssistantChatMessage,
  type AssistantConversationSummary,
  type AssistantSource,
  type AssistantStatus,
} from "@/lib/api";

const EXAMPLES = [
  "Aylık KDV beyannamesinin son günü resmi tatile denk gelirse ne olur?",
  "Muhtasar ve prim hizmet beyannamesi geç verilirse hangi cezalar uygulanır?",
  "e-Defter beratları ne zamana kadar yüklenmeli?",
  "İşe giriş bildirgesi hangi sürede verilmeli, istisnaları neler?",
];

const REDACTION_LABEL: Record<string, string> = {
  tckn: "TCKN",
  vkn: "VKN",
  iban: "IBAN",
  sicil: "sicil no",
  telefon: "telefon",
  email: "e-posta",
};

type Msg = Omit<AssistantChatMessage, "createdAt"> & { streaming?: boolean; error?: string };

/** **kalın**, _eğik_ ve `kod` biçimlerini React öğelerine çevirir (HTML enjekte etmeden). */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|(?<![\w])_[^_]+_(?![\w]))/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : p.startsWith("`") && p.endsWith("`") && p.length > 2 ? (
          <code key={i} className="rounded bg-slate-100 px-1 text-[0.85em]">
            {p.slice(1, -1)}
          </code>
        ) : p.startsWith("_") && p.endsWith("_") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Asistanın kullandığı sade biçim: paragraflar ve madde/numara listeleri. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          const ordered = /^\s*\d/.test(lines[0]);
          const items = lines.map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
              {items.map((it, j) => (
                <li key={j}>
                  <Inline text={it} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}

function Sources({ sources }: { sources: AssistantSource[] }) {
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="mb-1 text-xs font-semibold text-slate-500">Kaynaklar</p>
      <ul className="space-y-0.5 text-xs">
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <Link2 size={12} /> {s.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AssistantView() {
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const seq = useRef(0);

  const refreshList = useCallback(
    () =>
      Promise.all([api<AssistantStatus>("/assistant/status"), api<AssistantConversationSummary[]>("/assistant/conversations")]).then(
        ([s, c]) => {
          setStatus(s);
          setConversations(c);
        },
      ),
    [],
  );

  useEffect(() => {
    refreshList().catch((e) => setError(e.message));
    return () => abortRef.current?.abort();
  }, [refreshList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function open(id: string) {
    if (busy) return;
    setError(null);
    try {
      const c = await api<{ id: string; messages: AssistantChatMessage[] }>(`/assistant/conversations/${id}`);
      setActiveId(c.id);
      setMessages(c.messages);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function remove(id: string) {
    if (!confirm("Bu sohbet silinsin mi?")) return;
    try {
      await api(`/assistant/conversations/${id}`, { method: "DELETE" });
      if (id === activeId) newChat();
      await refreshList();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    setInput("");
    const ac = new AbortController();
    abortRef.current = ac;
    const n = ++seq.current;
    const tempUser = `tmp-u-${n}`;
    const tempAnswer = `tmp-a-${n}`;
    setMessages((m) => [
      ...m,
      { id: tempUser, role: "USER", content: q, redactions: null, sources: null },
      { id: tempAnswer, role: "ASSISTANT", content: "", redactions: null, sources: null, streaming: true },
    ]);
    const patchAnswer = (fn: (m: Msg) => Msg) => setMessages((all) => all.map((m) => (m.id === tempAnswer ? fn(m) : m)));

    try {
      await apiStream(
        "/assistant/ask",
        { message: q, ...(activeId ? { conversationId: activeId } : {}) },
        (event, raw) => {
          const data = raw as Record<string, unknown>;
          if (event === "meta") {
            setActiveId(data.conversationId as string);
            const redactions = data.redactions as Record<string, number>;
            // Ekranda da sunucuya gidip kaydedilen (maskelenmiş) hâli gösterilir
            setMessages((all) =>
              all.map((m) =>
                m.id === tempUser
                  ? { ...m, id: data.userMessageId as string, content: data.question as string, redactions: Object.keys(redactions).length ? redactions : null }
                  : m,
              ),
            );
          } else if (event === "delta") {
            patchAnswer((m) => ({ ...m, content: m.content + (data.text as string) }));
          } else if (event === "done") {
            patchAnswer((m) => ({ ...m, id: data.messageId as string, streaming: false, sources: (data.sources as AssistantSource[]) ?? null }));
          } else if (event === "error") {
            patchAnswer((m) => ({ ...m, streaming: false, error: data.message as string }));
          }
        },
        ac.signal,
      );
    } catch (e) {
      if (ac.signal.aborted) patchAnswer((m) => ({ ...m, streaming: false, error: "Yanıt durduruldu." }));
      else {
        setMessages((all) => all.filter((m) => m.id !== tempAnswer && m.id !== tempUser));
        setInput(q);
        setError((e as Error).message);
      }
    } finally {
      patchAnswer((m) => ({ ...m, streaming: false }));
      abortRef.current = null;
      setBusy(false);
      refreshList().catch(() => {});
    }
  }

  const limitReached = !!status && status.usedToday >= status.dailyLimit;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Sparkles size={20} className="text-brand-600" /> Uzmana Sor
          </h1>
          <p className="text-xs text-slate-500">Vergi ve SGK mevzuatı hakkında genel sorular için yapay zekâ asistanı</p>
        </div>
        {status && (
          <div className="flex items-center gap-2 text-xs">
            {status.mode === "mock" && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">Demo modu</span>}
            {status.webSearch && <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-800">Resmi kaynaklarda arama açık</span>}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              Bugün {status.usedToday}/{status.dailyLimit} soru
            </span>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm text-brand-900">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>
          Portaldaki firma, beyanname ve SGK verileriniz asistana <b>gönderilmez</b>. Yazdığınız TCKN, VKN, IBAN, sicil no, telefon ve
          e-posta otomatik gizlenir; yine de mükellef adı gibi kişisel bilgileri yazmayın. Yanıtlar bilgi amaçlıdır, mesleki
          değerlendirmenin yerini tutmaz.
        </span>
      </p>

      {status && !status.enabled && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">Asistan bu kurulumda kapalı.</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="space-y-2">
          <button
            onClick={newChat}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
          >
            <MessageSquarePlus size={16} /> Yeni sohbet
          </button>
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  onClick={() => open(c.id)}
                  className={`min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-left text-sm ${
                    c.id === activeId ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-white"
                  }`}
                  title={c.title}
                >
                  {c.title}
                </button>
                <button
                  onClick={() => remove(c.id)}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Sohbeti sil"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {conversations.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Henüz sohbet yok</li>}
          </ul>
        </aside>

        <section className="flex min-h-[60vh] flex-col rounded-xl border border-slate-200 bg-white">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-slate-500">Örnek sorular</p>
                <div className="mx-auto grid grid-cols-1 max-w-2xl gap-2 sm:grid-cols-2">
                  {EXAMPLES.map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      disabled={busy || !status?.enabled || limitReached}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) =>
              m.role === "USER" ? (
                <div key={m.id} className="flex flex-col items-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-2 text-sm whitespace-pre-wrap text-white">
                    {m.content}
                  </div>
                  {m.redactions && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <EyeOff size={12} /> Gizlendi:{" "}
                      {Object.entries(m.redactions)
                        .map(([k, n]) => `${n} ${REDACTION_LABEL[k] ?? k}`)
                        .join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  {m.content ? <RichText text={m.content} /> : m.streaming ? <span className="text-slate-400">Yanıt hazırlanıyor…</span> : null}
                  {m.streaming && m.content && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand-500 align-middle" />}
                  {m.error && <p className="mt-2 text-sm text-red-700">{m.error}</p>}
                  {m.sources && m.sources.length > 0 && <Sources sources={m.sources} />}
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex items-end gap-2 border-t border-slate-200 p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={2}
              maxLength={4000}
              disabled={!status?.enabled || limitReached}
              placeholder={limitReached ? "Günlük soru sınırı doldu" : "Sorunuzu yazın (Enter: gönder, Shift+Enter: yeni satır)"}
              className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 disabled:bg-slate-50"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <Square size={14} /> Durdur
              </button>
            ) : (
              <button
                type="submit"
                disabled={input.trim().length < 2 || !status?.enabled || limitReached}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Send size={14} /> Sor
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
