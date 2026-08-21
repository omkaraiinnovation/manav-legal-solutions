"use client";
import { useState } from "react";
import { Loader2, Send, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { QaHistoryRecord } from "@/lib/db/documents-repo";

const SUGGESTED = [
  "What are the principal allegations?",
  "What are the relevant dates?",
  "Which sections have been invoked?",
  "What facts are missing?",
];

const CONFIDENCE_META = {
  grounded: { Icon: ShieldCheck, color: "var(--verified)", label: "Grounded in sources" },
  partial: { Icon: ShieldQuestion, color: "var(--unverified)", label: "Partially grounded" },
  insufficient: { Icon: ShieldAlert, color: "var(--flagged)", label: "Insufficient information" },
};

export function QaPanel({ matterId, initialHistory }: { matterId: string; initialHistory: QaHistoryRecord[] }) {
  const [history, setHistory] = useState<QaHistoryRecord[]>(initialHistory);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setQuestion("");
    try {
      const res = await fetch(`/api/matters/${matterId}/qa`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setHistory((h) => [{ id: crypto.randomUUID(), matterId, question: q, answer: data.answer, sources: data.sources, confidence: data.confidence, modelUsed: data.modelUsed, createdAt: new Date().toISOString() }, ...h]);
    } catch (err) {
      setHistory((h) => [{ id: crypto.randomUUID(), matterId, question: q, answer: err instanceof Error ? err.message : "Something went wrong.", sources: [], confidence: "insufficient", modelUsed: "error", createdAt: new Date().toISOString() }, ...h]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); ask(question); }} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this matter's documents or applicable law…"
          className="flex-1 rounded-[8px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]"
          style={{ borderColor: "var(--hairline)" }}
        />
        <button type="submit" disabled={loading || !question.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-white disabled:opacity-40" style={{ background: "var(--oxblood)" }}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </form>

      {history.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} className="rounded-full border px-3 py-1 text-xs hover:bg-[var(--paper-sunken)]" style={{ borderColor: "var(--hairline)" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {history.map((h) => {
          const meta = CONFIDENCE_META[h.confidence] ?? CONFIDENCE_META.partial;
          return (
            <div key={h.id} className="paper-card p-4">
              <div className="text-sm font-medium">{h.question}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{h.answer}</div>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs" style={{ color: meta.color }}>
                <meta.Icon size={13} /> {meta.label}
                {h.sources.length > 0 && <span className="text-ink-faint">· {h.sources.length} source{h.sources.length === 1 ? "" : "s"}</span>}
              </div>
              {h.sources.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--oxblood)" }}>View sources</summary>
                  <ul className="mt-1.5 space-y-1.5">
                    {h.sources.map((s, i) => (
                      <li key={i} className="text-xs text-ink-faint">
                        <span className="font-medium text-ink-soft">{s.label}:</span> "{s.snippet}"
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
