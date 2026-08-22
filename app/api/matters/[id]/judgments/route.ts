import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, logAudit } from "@/lib/db/repo";
import { JudgmentResearch } from "@/lib/db/judgment-repo";
import { researchJudgments, JudgmentResearchError } from "@/lib/agents/judgment-research-agent";

export const maxDuration = 120; // web_search runs multiple searches sequentially inside one Anthropic call — needs more room than a typical route

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const history = await JudgmentResearch.byMatter(id);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const matter = await Matters.get(id);
  if (!matter) return NextResponse.json({ error: "Matter not found, or you do not have access to it." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" && body.query.trim() ? body.query.trim() : matter.facts;
  if (!query.trim()) {
    return NextResponse.json({ error: "No research topic given, and the matter has no facts on file to research from." }, { status: 400 });
  }

  try {
    const result = await researchJudgments({ query, jurisdictionState: matter.jurisdiction.state, actContext: body.actContext });
    const record = await JudgmentResearch.create({
      matterId: id, tenantId: matter.tenantId, query, jurisdictionState: matter.jurisdiction.state,
      summary: result.summary, judgments: result.judgments, verifiedSourceUrls: result.verifiedSourceUrls,
      searchesUsed: result.searchesUsed, modelUsed: result.modelUsed, requestedBy: user.id,
    });
    await logAudit({
      tenantId: matter.tenantId, actorId: user.id, action: "judgment.research", entityType: "matter", entityId: id,
      metadata: { judgmentCount: result.judgments.length, searchesUsed: result.searchesUsed },
    });
    return NextResponse.json({ research: record });
  } catch (err) {
    const message = err instanceof JudgmentResearchError ? err.message : `Judicial research failed: ${err instanceof Error ? err.message : "unknown error"}`;
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
