import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, logAudit } from "@/lib/db/repo";
import { QaHistory } from "@/lib/db/documents-repo";
import { answerMatterQuestion } from "@/lib/agents/qa-agent";

export const maxDuration = 30;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matterId } = await params;
  const user = await getCurrentUser();
  const { question } = await req.json();

  if (!question || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const matter = await Matters.get(matterId);
  if (!matter) return NextResponse.json({ error: "Matter not found." }, { status: 404 });

  try {
    const result = await answerMatterQuestion(matterId, question);

    await QaHistory.create({
      matterId, tenantId: matter.tenantId, question, answer: result.answer, sources: result.sources,
      confidence: result.confidence, modelUsed: result.modelUsed, askedBy: user.id,
    });
    await logAudit({ tenantId: matter.tenantId, actorId: user.id, action: "matter.qa", entityType: "matter", entityId: matterId, metadata: { confidence: result.confidence, sourceCount: result.sources.length } });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: `Q&A failed: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matterId } = await params;
  const history = await QaHistory.byMatter(matterId);
  return NextResponse.json({ history });
}
