import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, DocumentTypes, Drafts, DraftCitations, logAudit } from "@/lib/db/repo";
import { generateDraft } from "@/lib/agents/drafting-agent";
import { runVerificationPass } from "@/lib/agents/verification-agent";
import type { Draft, DraftCitation } from "@/lib/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const { matterId, documentTypeId, variables } = await req.json();

  const matter = Matters.get(matterId);
  const documentType = DocumentTypes.get(documentTypeId);
  if (!matter || !documentType) {
    return NextResponse.json({ error: "matter or documentType not found" }, { status: 404 });
  }

  const generation = await generateDraft({ matter, documentType, variables: variables ?? {} });
  const verification = runVerificationPass(generation.content);
  const verifiedCount = verification.findings.filter((f) => f.verificationStatus === "verified").length;
  const coverageScore = verification.findings.length ? Math.round((verifiedCount / verification.findings.length) * 100) : 100;

  const draft: Draft = {
    id: crypto.randomUUID(),
    matterId,
    documentTypeId,
    title: `${documentType.name} — ${matter.title}`,
    content: generation.content,
    variables: variables ?? {},
    status: "ai_generated",
    generatedBy: "drafting_agent",
    coverageScore,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  Drafts.create(draft);

  const citations: DraftCitation[] = verification.findings.map((f) => ({
    id: crypto.randomUUID(),
    draftId: draft.id,
    provisionId: f.provisionId,
    caseLawId: f.caseLawId,
    citedText: f.citedText,
    verificationStatus: f.verificationStatus,
    flagReason: f.flagReason,
  }));
  if (citations.length) DraftCitations.bulkCreate(citations);

  logAudit({ tenantId: user.tenantId, actorId: user.id, action: "draft.generate", entityType: "draft", entityId: draft.id, metadata: { mode: generation.mode, coverageScore } });

  return NextResponse.json({ draft, verification });
}
