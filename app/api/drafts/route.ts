import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, DocumentTypes, Drafts, DraftCitations, logAudit } from "@/lib/db/repo";
import { generateDraft } from "@/lib/agents/drafting-agent";
import { runVerificationPass } from "@/lib/agents/verification-agent";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const { matterId, documentTypeId, variables } = await req.json();

  const [matter, documentType] = await Promise.all([Matters.get(matterId), DocumentTypes.get(documentTypeId)]);
  if (!matter || !documentType) {
    return NextResponse.json({ error: "matter or documentType not found" }, { status: 404 });
  }

  const generation = await generateDraft({ matter, documentType, variables: variables ?? {} });
  const verification = await runVerificationPass(generation.content);
  const verifiedCount = verification.findings.filter((f) => f.verificationStatus === "verified").length;
  const coverageScore = verification.findings.length ? Math.round((verifiedCount / verification.findings.length) * 100) : 100;

  const draft = await Drafts.create({
    matterId, documentTypeId,
    title: `${documentType.name} — ${matter.title}`,
    content: generation.content,
    variables: variables ?? {},
    status: "ai_generated",
    generatedBy: "drafting_agent",
    coverageScore,
  });

  const citations = verification.findings.map((f) => ({
    draftId: draft.id, provisionId: f.provisionId, caseLawId: f.caseLawId,
    citedText: f.citedText, verificationStatus: f.verificationStatus, flagReason: f.flagReason,
  }));
  if (citations.length) await DraftCitations.bulkCreate(citations);

  await logAudit({ tenantId: user.tenantId, actorId: user.id, action: "draft.generate", entityType: "draft", entityId: draft.id, metadata: { mode: generation.mode, coverageScore } });

  return NextResponse.json({ draft, verification });
}
