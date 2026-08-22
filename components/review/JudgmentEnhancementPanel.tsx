"use client";
import { useState } from "react";
import { Loader2, Sparkles, Landmark, Scale, Gavel, ExternalLink, ShieldCheck, ThumbsUp, ThumbsDown, HelpCircle, AlertTriangle } from "lucide-react";
import type { CourtTier, JudgmentStance } from "@/lib/agents/judgment-research-agent";

interface DraftLegalIssue { issue: string; actSectionContext?: string; draftExcerpt: string }
interface JudgmentResult {
  caseTitle: string; courtTier: CourtTier; courtName: string; dateText?: string; citation?: string;
  sourceUrl: string; sourceTitle: string; isOfficialSource: boolean; extract: string;
  relevanceExplanation: string; relevantTo?: string; stance: JudgmentStance;
}
interface Suggestion { issue: DraftLegalIssue; judgments: JudgmentResult[]; summary: string }
interface Report { issuesAnalyzed: DraftLegalIssue[]; suggestions: Suggestion[] }

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

export function JudgmentEnhancementPanel({ draftId, initial }: { draftId: string; initial: Report | null }) {
  const [report, setReport] = useState<Report | null>(initial && initial.suggestions.length > 0 ? initial : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/judgment-review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Judicial enhancement review failed.");
      setReport(data.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Judicial Enhancement Review</div>
        <button
          onClick={run}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {report ? "Re-run" : "Find Supporting Authority"}
        </button>
      </div>

      {error && <div className="mb-3 rounded-[8px] border px-3 py-2 text-xs" style={{ borderColor: "var(--flagged)", color: "var(--flagged)" }}>{error}</div>}

      {!report && !loading && !error && (
        <p className="text-xs text-ink-faint">Analyzes this draft's actual propositions and searches for Supreme Court / High Court judgments that could strengthen them.</p>
      )}

      {report && report.suggestions.length === 0 && (
        <p className="text-xs text-ink-faint">No distinct legal propositions were identified in this draft to research.</p>
      )}

      {report && report.suggestions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-start gap-1.5 text-[11px] text-ink-faint">
            <AlertTriangle size={11} className="mt-0.5 shrink-0" style={{ color: "var(--unverified)" }} />
            <span>Current validity of older precedents is not independently verified — confirm on a citator before citing.</span>
          </div>
          {report.suggestions.map((s, i) => (
            <div key={i} className="paper-card p-3.5">
              <div className="text-xs font-medium">{s.issue.issue}</div>
              {s.issue.draftExcerpt && <p className="mt-1 border-l-2 pl-2 text-[11px] italic text-ink-faint" style={{ borderColor: "var(--hairline)" }}>"{s.issue.draftExcerpt}"</p>}
              {s.summary && <p className="mt-1.5 text-xs text-ink-soft">{s.summary}</p>}
              {s.judgments.length === 0 ? (
                <p className="mt-2 text-xs text-ink-faint">No relevant judgments found.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {s.judgments.map((j, ji) => {
                    const tier = TIER_META[j.courtTier];
                    const stance = STANCE_META[j.stance];
                    return (
                      <div key={ji} className="rounded-[6px] border p-2.5" style={{ borderColor: "var(--hairline)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-xs font-medium">
                            <tier.Icon size={11} style={{ color: tier.color }} /> {j.caseTitle}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium" style={{ color: stance.color }}>
                            <stance.Icon size={9} /> {stance.label}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-faint">
                          {j.courtName}{j.dateText ? ` · ${j.dateText}` : ""}
                          {j.isOfficialSource && <ShieldCheck size={9} style={{ color: "var(--verified)" }} />}
                        </div>
                        <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--oxblood)" }}>
                          {j.sourceTitle} <ExternalLink size={9} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
