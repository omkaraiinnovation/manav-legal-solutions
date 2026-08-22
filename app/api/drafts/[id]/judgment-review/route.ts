import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Drafts, Matters, logAudit } from "@/lib/db/repo";
import { JudgmentResearch } from "@/lib/db/judgment-repo";
import { runJudgmentEnhancementReview } from "@/lib/agents/judgment-review-agent";

export const maxDuration = 120; // up to 3 concurrent web-search research calls

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await JudgmentResearch.byDraft(id);
  return NextResponse.json({
    report: {
      issuesAnalyzed: rows.map((r) => ({ issue: r.query, actSectionContext: r.actSectionContext, draftExcerpt: r.draftExcerpt })),
      suggestions: rows.map((r) => ({ issue: { issue: r.query, actSectionContext: r.actSectionContext, draftExcerpt: r.draftExcerpt }, judgments: r.judgments, summary: r.summary })),
    },
    generatedAt: rows[0]?.createdAt,
  });
}

/**
 * Judicial Enhancement Review (spec §5-7, §11-12): the "What judicial
 * authorities should strengthen this draft?" action, run directly from the
 * drafting/review workflow rather than a separate judgment-search screen.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const draft = await Drafts.get(id);
  if (!draft) return NextResponse.json({ error: "Draft not found, or you do not have access to it." }, { status: 404 });
  const matter = await Matters.get(draft.matterId);
  if (!matter) return NextResponse.json({ error: "The matter for this draft could not be found." }, { status: 404 });

  try {
    const report = await runJudgmentEnhancementReview(draft.content, matter.jurisdiction.state);

    const rows = await Promise.all(
      report.suggestions.map((s) =>
        JudgmentResearch.create({
          matterId: matter.id, draftId: id, tenantId: matter.tenantId, query: s.issue.issue, jurisdictionState: matter.jurisdiction.state,
          summary: s.summary, judgments: s.judgments, verifiedSourceUrls: [], searchesUsed: 0, modelUsed: "anthropic-web-search",
          requestedBy: user.id, draftExcerpt: s.issue.draftExcerpt, actSectionContext: s.issue.actSectionContext,
        })
      )
    );

    await logAudit({
      tenantId: matter.tenantId, actorId: user.id, action: "judgment.enhancement_review", entityType: "draft", entityId: id,
      metadata: { issuesAnalyzed: report.issuesAnalyzed.length, totalJudgments: report.suggestions.reduce((n, s) => n + s.judgments.length, 0) },
    });

    return NextResponse.json({
      report: {
        issuesAnalyzed: report.issuesAnalyzed,
        suggestions: rows.map((r, i) => ({ issue: report.suggestions[i].issue, judgments: r.judgments, summary: r.summary })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Judicial enhancement review failed." }, { status: 422 });
  }
}
