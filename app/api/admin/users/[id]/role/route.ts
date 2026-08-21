import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Users, logAudit } from "@/lib/db/repo";
import type { User } from "@/lib/types";

const VALID_ROLES: User["role"][] = ["platform_admin", "firm_admin", "advocate", "paralegal", "client"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await params;
  const actor = await getCurrentUser();

  if (actor.role !== "firm_admin" && actor.role !== "platform_admin") {
    return NextResponse.json({ error: "Only firm or platform admins can change roles." }, { status: 403 });
  }

  const { role } = await req.json();
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  await Users.updateRole(targetUserId, role);
  await logAudit({ tenantId: actor.tenantId, actorId: actor.id, action: "user.role_change", entityType: "user", entityId: targetUserId, metadata: { newRole: role } });

  return NextResponse.json({ ok: true });
}
