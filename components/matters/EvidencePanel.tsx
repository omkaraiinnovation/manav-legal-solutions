"use client";
import { useState } from "react";
import { Loader2, Sparkles, AlertOctagon, FileWarning, Copy, Calendar, Banknote, User, MapPin, CalendarClock, FileQuestion, ChevronDown } from "lucide-react";
import type { EvidenceAnalysisRecord, EvidenceFact } from "@/lib/db/evidence-repo";

const FACT_TYPE_META: Record<EvidenceFact["factType"], { Icon: typeof Calendar; label: string }> = {
  date: { Icon: Calendar, label: "Date" },
  amount: { Icon: Banknote, label: "Amount" },
  name: { Icon: User, label: "Name" },
  location: { Icon: MapPin, label: "Location" },
  event: { Icon: CalendarClock, label: "Event" },
  allegation: { Icon: FileWarning, label: "Allegation" },
  other: { Icon: FileQuestion, label: "Other" },
};

const SEVERITY_COLOR: Record<"high" | "medium" | "low", string> = {
  high: "var(--flagged)", medium: "var(--unverified)", low: "var(--ink-faint)",
};

export function EvidencePanel({ matterId, initial }: { matterId: string; initial: EvidenceAnalysisRecord | null }) {
  const [analysis, setAnalysis] = useState<EvidenceAnalysisRecord | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFact, setExpandedFact] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/evidence`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evidence analysis failed.");
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const factsById = new Map((analysis?.facts ?? []).map((f) => [f.id, f]));

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Cross-references the facts narrative against every parsed document to build a source-cited fact matrix and flag contradictions or unsupported allegations.
        </p>
        <button
          onClick={run}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "var(--oxblood)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {analysis ? "Re-run Analysis" : "Run Evidence Analysis"}
        </button>
      </div>

      {error && <div className="mt-3 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--flagged)", color: "var(--flagged)" }}>{error}</div>}

      {!analysis && !loading && !error && (
        <div className="mt-4 rounded-[8px] border border-dashed p-6 text-center text-sm text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
          No analysis has been run yet for this matter.
        </div>
      )}

      {analysis && (
        <div className="mt-5 space-y-6">
          <div className="text-xs text-ink-faint">
            Generated {new Date(analysis.createdAt).toLocaleString()} · model: {analysis.modelUsed || "unknown"}
          </div>

          {/* Contradictions — surfaced first, highest severity */}
          {analysis.contradictions.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--flagged)" }}>
                <AlertOctagon size={15} /> Contradictions ({analysis.contradictions.length})
              </h4>
              <div className="space-y-2">
                {analysis.contradictions.map((c, i) => (
                  <div key={i} className="paper-card p-3.5" style={{ borderLeft: `3px solid ${SEVERITY_COLOR[c.severity]}` }}>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ color: SEVERITY_COLOR[c.severity], background: "var(--paper-sunken)" }}>{c.severity}</span>
                      <span className="text-sm">{c.description}</span>
                    </div>
                    <div className="mt-2 space-y-1 border-l pl-3" style={{ borderColor: "var(--hairline)" }}>
                      {c.factIds.map((fid) => {
                        const f = factsById.get(fid);
                        return f ? <div key={fid} className="text-xs text-ink-faint">"{f.claim}"</div> : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing support */}
          {analysis.missingSupport.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--unverified)" }}>
                <FileWarning size={15} /> Missing Documentary Support ({analysis.missingSupport.length})
              </h4>
              <div className="space-y-1.5">
                {analysis.missingSupport.map((m, i) => (
                  <div key={i} className="paper-card p-3 text-sm">
                    <div>{m.allegation}</div>
                    {m.note && <div className="mt-1 text-xs text-ink-faint">{m.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicates */}
          {analysis.duplicates.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                <Copy size={15} /> Likely Duplicate Documents ({analysis.duplicates.length})
              </h4>
              <div className="space-y-1.5">
                {analysis.duplicates.map((d, i) => (
                  <div key={i} className="paper-card p-3 text-sm text-ink-soft">{d.description}</div>
                ))}
              </div>
            </div>
          )}

          {/* Fact matrix */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Fact Matrix ({analysis.facts.length})</h4>
            {analysis.facts.length === 0 ? (
              <div className="rounded-[8px] border border-dashed p-4 text-center text-xs text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
                No facts extracted — add matter details or upload documents, then re-run.
              </div>
            ) : (
              <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
                {analysis.facts.map((f) => {
                  const meta = FACT_TYPE_META[f.factType] ?? FACT_TYPE_META.other;
                  const isOpen = expandedFact === f.id;
                  return (
                    <div key={f.id}>
                      <button onClick={() => setExpandedFact(isOpen ? null : f.id)} className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-[var(--paper-sunken)]">
                        <meta.Icon size={14} className="shrink-0 text-ink-faint" />
                        <span className="flex-1 text-sm">{f.claim}</span>
                        <span className="shrink-0 text-[10px] uppercase text-ink-faint">{meta.label}</span>
                        <span className="shrink-0 text-xs text-ink-faint">{f.sources.length} src</span>
                        <ChevronDown size={13} className={`shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="space-y-1.5 px-3.5 pb-3.5 pl-10">
                          {f.sources.map((s, i) => (
                            <div key={i} className="text-xs text-ink-faint">
                              <span className="font-medium text-ink-soft">
                                {s.type === "client_narrative" ? "Client narrative" : `${s.documentName}${s.page ? ` (p.${s.page})` : ""}`}:
                              </span>{" "}
                              "{s.snippet}"
                            </div>
                          ))}
                          {f.sources.length === 0 && <div className="text-xs text-ink-faint">No specific source cited.</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
