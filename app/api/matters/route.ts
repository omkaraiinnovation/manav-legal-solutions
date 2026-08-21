import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Matters, MatterParties, ChronologyEvents, logAudit } from "@/lib/db/repo";
import { runApplicableLawSweep } from "@/lib/agents/applicable-law-agent";
import { detectApplicableAreas } from "@/lib/legal/taxonomy";
import type { LegalDomain, IndiaStateOrUT } from "@/lib/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const body = await req.json();
  const {
    personType, title, facts, reliefSought, state, district, court,
    domain, clientName, opposingPartyName, incidentDate,
  } = body;

  if (!facts || typeof facts !== "string") {
    return NextResponse.json({ error: "facts is required" }, { status: 400 });
  }

  const sweep = await runApplicableLawSweep(facts, { level: "state", state: state as IndiaStateOrUT }, domain ? [domain as LegalDomain] : []);
  const detections = detectApplicableAreas(facts);
  const specialActTags = [...new Set(detections.map((d) => d.specialActTag).filter((t): t is NonNullable<typeof t> => !!t))];
  const sensitivity = sweep.suggestedDomains.some((d) => d === "children_juvenile" || d === "women_gender") ? "restricted" : "standard";

  const matter = await Matters.create({
    tenantId: user.tenantId,
    clientId: user.role === "client" ? user.id : undefined,
    title: title?.trim() || `${clientName || "New Client"} — Intake ${new Date().toLocaleDateString("en-IN")}`,
    status: "intake",
    domains: sweep.suggestedDomains,
    specialActTags,
    jurisdiction: { level: "state", state: state as IndiaStateOrUT, district, court },
    sensitivityLevel: sensitivity,
    facts,
    reliefSought,
  });

  if (clientName) {
    await MatterParties.create({ matterId: matter.id, role: "client", fullName: clientName, personType });
  }
  if (opposingPartyName) {
    await MatterParties.create({ matterId: matter.id, role: "opposite_party", fullName: opposingPartyName });
  }
  if (incidentDate) {
    await ChronologyEvents.create({ matterId: matter.id, eventDate: incidentDate, description: "Reported incident date (from intake).", source: "manual" });
  }
  await ChronologyEvents.create({ matterId: matter.id, eventDate: new Date().toISOString().slice(0, 10), description: "Matter opened via Legal Matter Intake.", source: "manual" });

  await logAudit({ tenantId: user.tenantId, actorId: user.id, action: "matter.create", entityType: "matter", entityId: matter.id });

  return NextResponse.json({ matter, sweep });
}
