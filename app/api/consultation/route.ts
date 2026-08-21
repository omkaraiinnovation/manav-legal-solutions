import { NextRequest, NextResponse } from "next/server";
import { runConsultation } from "@/lib/agents/consultation-agent";
import { getCurrentUser } from "@/lib/session";
import { ChatMessages, logAudit } from "@/lib/db/repo";
import type { Jurisdiction } from "@/lib/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json();
  const { message, history, jurisdiction, matterId } = body as {
    message: string;
    history: { role: "user" | "assistant"; content: string }[];
    jurisdiction: Jurisdiction;
    matterId?: string;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await runConsultation({
    userMessage: message,
    history: history ?? [],
    jurisdiction: jurisdiction ?? { level: "state", state: "Bihar" },
    language: user.languagePref === "hi" ? "hi" : user.languagePref === "bilingual" ? "bilingual" : "en",
  });

  if (matterId) {
    await ChatMessages.create({ matterId, role: "user", content: message });
    await ChatMessages.create({ matterId, role: "assistant", content: result.reply, citedProvisionIds: result.citedProvisionIds });
  }

  await logAudit({ tenantId: user.tenantId, actorId: user.id, action: "consultation.message", entityType: "chat", entityId: matterId ?? "standalone", metadata: { mode: result.mode } });

  return NextResponse.json(result);
}
