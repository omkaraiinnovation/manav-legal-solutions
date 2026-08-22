"use client";
import { useState } from "react";
import { Loader2, Gavel, Landmark, Scale, ExternalLink, AlertTriangle, ThumbsUp, ThumbsDown, HelpCircle, ShieldCheck, Search } from "lucide-react";
import type { JudgmentResearchRecord } from "@/lib/db/judgment-repo";
import type { CourtTier, JudgmentStance } from "@/lib/agents/judgment-research-agent";

const TIER_META: Record<CourtTier, { label: string; Icon: typeof Landmark; color: string }> = {
  supreme_court: { label: "Supreme Court", Icon: Landmark, color: "var(--oxblood)" },
  high_court: { label: "High Court", Icon: Scale, color: "var(--brass)" },
  tribunal: { label: "Tribunal", Icon: Gavel, color: "var(--info)" },
  other: { label: "Other Authority", Icon: Gavel, color: "var(--ink-faint)" },
};

const STANCE_META: Record<JudgmentStance, { label: string; Icon: typeof ThumbsUp; color: string }> = {
  supports: { label: "Supports", Icon: ThumbsUp, color: "var(--verified)" },
  weakens: { label: "May weaken", Icon: ThumbsDown, color: "var(--flagged)" },
  contextual: { label: "Contextual", Icon: HelpCircle, color: "var(--info)" },
  unclear: { label: "Unclear relevance", Icon: HelpCircle, color: "var(--ink-faint)" },
};

export function JudgmentResearchPanel({ matterId, initial }: { matterId: string; initial: JudgmentResearchRecord | null }) {
  const [research, setResearch] = useState<JudgmentResearchRecord | null>(initial);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(useMatterFacts: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/judgments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: useMatterFacts ? undefined : query }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Judicial research failed.");
      setResearch(data.research);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-xs text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
        <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: "var(--unverified)" }} />
        <span>
          Searches Supreme Court, High Court, and reputable legal-research sources in real time via Claude's web search (billed per search on the firm's Anthropic account).
          Current validity (whether a judgment has since been overruled, distinguished, or modified) is <strong className="text-ink-soft">not independently verified</strong> — confirm on a citator (SCC Online / Manupatra) before relying on any result.
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Research topic — a legal issue, an Act/Section, or leave blank to research the matter's facts…"
          className="flex-1 rounded-[8px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]"
          style={{ borderColor: "var(--hairline)" }}
        />
        <button
          onClick={() => run(!query.trim())}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-[8px] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {research ? "Research Again" : "Run Judicial Research"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--flagged)", color: "var(--flagged)" }}>{error}</div>}

      {!research && !loading && !error && (
        <div className="mt-4 rounded-[8px] border border-dashed p-6 text-center text-sm text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
          No judicial research has been run yet for this matter.
        </div>
      )}

      {research && (
        <div className="mt-5 space-y-5">
          <div className="text-xs text-ink-faint">
            Researched "{research.query}" · {new Date(research.createdAt).toLocaleString()} · {research.searchesUsed} search{research.searchesUsed === 1 ? "" : "es"} run
          </div>

          {research.summary && (
            <div className="paper-card p-4 text-sm leading-relaxed">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brass)" }}>Current Judicial Landscape</div>
              {research.summary}
            </div>
          )}

          {research.judgments.length === 0 ? (
            <div className="rounded-[8px] border border-dashed p-4 text-center text-xs text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
              No genuinely relevant Supreme Court or High Court judgments were found for this topic.
            </div>
          ) : (
            <div className="space-y-2.5">
              {research.judgments.map((j, i) => {
                const tier = TIER_META[j.courtTier];
                const stance = STANCE_META[j.stance];
                return (
                  <div key={i} className="paper-card p-4" style={{ borderLeft: `3px solid ${tier.color}` }}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 text-sm font-semibold">
                          <tier.Icon size={13} style={{ color: tier.color }} />
                          {j.caseTitle}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                          <span>{j.courtName}</span>
                          {j.dateText && <span>· {j.dateText}</span>}
                          {j.citation && <span className="font-mono">· {j.citation}</span>}
                          {j.isOfficialSource && (
                            <span className="inline-flex items-center gap-1" style={{ color: "var(--verified)" }}>
                              <ShieldCheck size={11} /> Official source
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: stance.color, background: "var(--paper-sunken)" }}>
                        <stance.Icon size={10} /> {stance.label}
                      </span>
                    </div>
                    {j.extract && <p className="mt-2 whitespace-pre-wrap text-xs italic leading-relaxed text-ink-soft">"{j.extract}"</p>}
                    {j.relevanceExplanation && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{j.relevanceExplanation}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {j.relevantTo && <span className="text-[11px] text-ink-faint">Relevant to: {j.relevantTo}</span>}
                      <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium" style={{ color: "var(--oxblood)" }}>
                        {j.sourceTitle} <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
