import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, logAudit } from "@/lib/db/repo";
import { Documents } from "@/lib/db/documents-repo";
import { EvidenceAnalyses } from "@/lib/db/evidence-repo";
import { runEvidenceAnalysis, EvidenceAnalysisError } from "@/lib/agents/evidence-agent";

export const maxDuration = 60; // multi-document LLM reasoning call

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const latest = await EvidenceAnalyses.latestForMatter(id);
  return NextResponse.json({ analysis: latest ?? null });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const matter = await Matters.get(id);
  if (!matter) return NextResponse.json({ error: "Matter not found, or you do not have access to it." }, { status: 404 });

  const documents = await Documents.byMatter(id);

  try {
    const result = await runEvidenceAnalysis(matter.facts, documents);
    const record = await EvidenceAnalyses.create({
      matterId: id, tenantId: matter.tenantId, facts: result.facts, contradictions: result.contradictions,
      missingSupport: result.missingSupport, duplicates: result.duplicates, modelUsed: result.modelUsed, generatedBy: user.id,
    });
    await logAudit({
      tenantId: matter.tenantId, actorId: user.id, action: "evidence.analyze", entityType: "matter", entityId: id,
      metadata: { factCount: result.facts.length, contradictionCount: result.contradictions.length, documentsConsidered: documents.filter((d) => d.status === "parsed").length },
    });
    return NextResponse.json({ analysis: record });
  } catch (err) {
    const message = err instanceof EvidenceAnalysisError ? err.message : `Evidence analysis failed: ${err instanceof Error ? err.message : "unknown error"}`;
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
