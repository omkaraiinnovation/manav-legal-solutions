"use client";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Sparkles } from "lucide-react";
import type { Jurisdiction, IndiaStateOrUT } from "@/lib/types";
import { INDIA_STATES_AND_UTS } from "@/lib/types";

interface Message { role: "user" | "assistant"; content: string; }

const SUGGESTED = [
  "My landlord in Patna is refusing to return my security deposit.",
  "A cheque given to me for Rs. 50,000 has bounced.",
  "My neighbour's construction is encroaching on my land in Muzaffarpur.",
  "I received a notice from the GST department — what should I do?",
];

export function ChatPanel({ matterId }: { matterId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<IndiaStateOrUT>("Bihar");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const jurisdiction: Jurisdiction = { level: "state", state };
      const res = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: messages, jurisdiction, matterId }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Something went wrong reaching the consultation agent. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center gap-2 border-b px-6 py-3" style={{ borderColor: "var(--hairline)" }}>
        <span className="text-xs font-medium text-ink-faint">Jurisdiction:</span>
        <select
          value={state}
          onChange={(e) => setState(e.target.value as IndiaStateOrUT)}
          className="rounded-[6px] border bg-transparent px-2 py-1 text-xs"
          style={{ borderColor: "var(--hairline)" }}
        >
          {INDIA_STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto max-w-2xl animate-rise">
            <div className="mb-4 flex items-center gap-2" style={{ color: "var(--brass)" }}>
              <Sparkles size={18} />
              <span className="text-sm font-medium">Mode A — Consultation</span>
            </div>
            <h2 className="font-display text-2xl font-semibold">What happened, and where?</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Describe your situation in your own words — Hindi or English. We'll identify the applicable
              legal framework, explain your options in plain language, and flag anything that needs an
              advocate's urgent attention.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="paper-card px-4 py-3 text-left text-sm transition-transform hover:-translate-y-0.5"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-2xl space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`animate-rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-[14px] px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "text-white" : "paper-card"}`}
                style={m.role === "user" ? { background: "var(--oxblood)" } : undefined}
              >
                {m.role === "assistant" ? (
                  <div className="prose-legal">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="paper-card flex items-center gap-2 px-4 py-3 text-sm text-ink-faint">
                <Loader2 size={14} className="animate-spin" /> Running jurisdiction + applicable-law sweep…
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-end gap-2 border-t px-6 py-4"
        style={{ borderColor: "var(--hairline)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Describe your situation…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-[10px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]"
          style={{ borderColor: "var(--hairline)" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white disabled:opacity-40"
          style={{ background: "var(--oxblood)" }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
