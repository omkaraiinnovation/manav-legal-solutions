import { TopBar } from "@/components/shell/TopBar";
import { VerificationBadge, TrustLevelBadge } from "@/components/ui/Badges";
import { ReviewActionBar } from "@/components/review/ReviewActionBar";
import { getCurrentUser } from "@/lib/session";
import { Drafts, DraftCitations, Matters, DocumentTypes, Provisions, Acts, CaseLaws, ReviewActions } from "@/lib/db/repo";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { formatDateDisplay } from "@/lib/legal/date-utils";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const draft = await Drafts.get(id);
  if (!draft) notFound();

  const [matter, documentType, citations, history] = await Promise.all([
    Matters.get(draft.matterId), DocumentTypes.get(draft.documentTypeId),
    DraftCitations.byDraft(id), ReviewActions.byDraft(id),
  ]);
  const provisionCache = new Map(await Promise.all(
    citations.filter((c) => c.provisionId).map(async (c) => [c.provisionId!, await Provisions.get(c.provisionId!)] as const)
  ));
  const actCache = new Map(await Promise.all(
    [...new Set([...provisionCache.values()].filter(Boolean).map((p) => p!.actId))].map(async (actId) => [actId, await Acts.get(actId)] as const)
  ));
  const caseLawCache = new Map(await Promise.all(
    citations.filter((c) => c.caseLawId).map(async (c) => [c.caseLawId!, await CaseLaws.get(c.caseLawId!)] as const)
  ));

  return (
    <div>
      <TopBar currentUser={user} title={draft.title} subtitle={`${documentType?.name} · ${matter?.title}`} />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_280px]" style={{ minHeight: "calc(100vh - 4rem)" }}>

        {/* LEFT — AI Draft */}
        <div className="border-r p-6" style={{ borderColor: "var(--hairline)" }}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">AI Draft</div>
          <div className="paper-card prose-legal p-6 text-sm leading-relaxed">
            <ReactMarkdown>{draft.content}</ReactMarkdown>
          </div>
        </div>

        {/* CENTER — Sources & Citations */}
        <div className="border-r p-6" style={{ borderColor: "var(--hairline)" }}>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Sources & Citations</div>
          <div className="space-y-2.5">
            {citations.map((c) => {
              const provision = c.provisionId ? provisionCache.get(c.provisionId) : undefined;
              const act = provision ? actCache.get(provision.actId) : undefined;
              const caseLaw = c.caseLawId ? caseLawCache.get(c.caseLawId) : undefined;
              return (
                <div key={c.id} className="paper-card p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-medium leading-snug">{c.citedText}</span>
                    {act && <TrustLevelBadge level={act.trustLevel} />}
                  </div>
                  {provision && <div className="mt-1 text-xs text-ink-soft">{act?.shortName} — {provision.title}</div>}
                  {caseLaw && <div className="mt-1 text-xs text-ink-soft">{caseLaw.citation}</div>}
                  {c.flagReason && <div className="mt-1.5 text-xs" style={{ color: "var(--flagged)" }}>{c.flagReason}</div>}
                  <div className="mt-2"><VerificationBadge status={c.verificationStatus} /></div>
                </div>
              );
            })}
            {citations.length === 0 && <div className="text-sm text-ink-faint">No citations extracted from this draft.</div>}
          </div>
        </div>

        {/* RIGHT — Verification & Actions */}
        <div className="p-6">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Verification</div>
          <div className="paper-card mb-5 p-4">
            <div className="font-display text-2xl font-bold" style={{ color: (draft.coverageScore ?? 0) >= 80 ? "var(--verified)" : "var(--unverified)" }}>
              {draft.coverageScore ?? "—"}%
            </div>
            <div className="text-xs text-ink-faint">citations verified</div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-ink-faint">Verified</span><span>{citations.filter((c) => c.verificationStatus === "verified").length}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Unverified</span><span>{citations.filter((c) => c.verificationStatus === "unverified").length}</span></div>
              <div className="flex justify-between"><span className="text-ink-faint">Flagged</span><span>{citations.filter((c) => c.verificationStatus === "flagged").length}</span></div>
            </div>
          </div>

          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Review Action</div>
          <ReviewActionBar draftId={id} />

          {history.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">History</div>
              <div className="space-y-2">
                {history.map((h) => (
                  <div key={h.id} className="text-xs">
                    <span className="font-medium capitalize">{h.action.replaceAll("_", " ")}</span>
                    <span className="text-ink-faint"> · {formatDateDisplay(h.createdAt)}</span>
                    {h.notes && <p className="mt-0.5 text-ink-soft">{h.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
