import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Drafts, ReviewActions, logAudit } from "@/lib/db/repo";
import type { ReviewAction, DraftStatus } from "@/lib/types";

const ACTION_TO_STATUS: Record<ReviewAction["action"], DraftStatus> = {
  approve: "approved",
  edit: "in_review",
  reject: "rejected",
  request_revision: "revision_requested",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const { action, notes } = await req.json();

  const draft = Drafts.get(id);
  if (!draft) return NextResponse.json({ error: "draft not found" }, { status: 404 });

  const review: ReviewAction = {
    id: crypto.randomUUID(), draftId: id, reviewerId: user.id, action, notes, createdAt: new Date().toISOString(),
  };
  ReviewActions.create(review);
  Drafts.update(id, { status: ACTION_TO_STATUS[action as ReviewAction["action"]], updatedAt: new Date().toISOString() });

  logAudit({ tenantId: user.tenantId, actorId: user.id, action: `draft.review.${action}`, entityType: "draft", entityId: id, metadata: { notes } });

  return NextResponse.json({ ok: true });
}
