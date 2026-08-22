"use client";
import { useState } from "react";
import { Search, Loader2, FileText, Sparkles, Hash } from "lucide-react";

interface SmartSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  sectionHeading?: string;
  snippet: string;
  matchType: "semantic" | "keyword" | "both";
  similarity?: number;
}

const SUGGESTED = [
  "What does the complainant say happened?",
  "Section 420",
  "Every mention of the disputed property",
];

const MATCH_BADGE: Record<SmartSearchResult["matchType"], { label: string; color: string }> = {
  both: { label: "Strong match", color: "var(--verified)" },
  semantic: { label: "Related", color: "var(--info)" },
  keyword: { label: "Exact text", color: "var(--brass)" },
};

export function SmartSearchPanel({ matterId }: { matterId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SmartSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [warning, setWarning] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/search`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      setResults(data.results ?? []);
      setWarning(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); search(query); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this matter's documents — a question, a phrase, a section number…"
            className="w-full rounded-[8px] border bg-transparent py-2.5 pl-9 pr-3.5 text-sm outline-none focus:border-[var(--oxblood)]"
            style={{ borderColor: "var(--hairline)" }}
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-white disabled:opacity-40" style={{ background: "var(--oxblood)" }}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
        </button>
      </form>

      {!searched && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => { setQuery(s); search(s); }} className="rounded-full border px-3 py-1 text-xs hover:bg-[var(--paper-sunken)]" style={{ borderColor: "var(--hairline)" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {warning && <div className="mt-3 text-xs" style={{ color: "var(--unverified)" }}>{warning}</div>}
      {error && <div className="mt-3 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--flagged)", color: "var(--flagged)" }}>{error}</div>}

      {searched && !loading && !error && results.length === 0 && (
        <div className="mt-4 rounded-[8px] border border-dashed p-6 text-center text-sm text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
          No matches found in this matter's documents for "{query}".
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r) => {
            const badge = MATCH_BADGE[r.matchType];
            return (
              <div key={r.chunkId} className="paper-card p-3.5">
                <div className="flex items-center gap-2">
                  <FileText size={13} className="shrink-0 text-ink-faint" />
                  <span className="truncate text-sm font-medium">{r.documentName}</span>
                  {r.page && <span className="shrink-0 text-xs text-ink-faint">p.{r.page}</span>}
                  {r.sectionHeading && <span className="shrink-0 text-xs text-ink-faint">· {r.sectionHeading}</span>}
                  <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: badge.color, background: "var(--paper-sunken)" }}>
                    {r.matchType === "keyword" ? <Hash size={9} /> : <Sparkles size={9} />} {badge.label}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">"{r.snippet}{r.snippet.length >= 500 ? "…" : ""}"</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
