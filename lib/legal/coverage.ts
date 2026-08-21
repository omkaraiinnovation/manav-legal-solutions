import type { Matter, LegalCoverageAudit } from "@/lib/types";
import { resolveApplicableActs } from "./jurisdiction";
import { detectApplicableAreas } from "./taxonomy";
import { Deadlines, CaseLaws } from "@/lib/db/repo";

export async function computeCoverageAudit(matter: Matter): Promise<LegalCoverageAudit> {
  const { central, state, conflictFlag } = await resolveApplicableActs(matter.jurisdiction, matter.domains);
  const detections = detectApplicableAreas(matter.facts);
  const [deadlines, caseLaw] = await Promise.all([Deadlines.byMatter(matter.id), CaseLaws.all()]);

  const items: LegalCoverageAudit["items"] = [
    { label: "Constitutional provisions considered", checked: matter.domains.includes("constitutional") || true, note: "Baseline Art. 21/14 screen applied to every matter" },
    { label: "General Act identified", checked: central.length > 0, note: central.map((a) => a.shortName).join(", ") || "None resolved yet" },
    { label: "Special Act(s) screened", checked: detections.length > 0, note: detections.map((d) => d.actShortName).join(", ") || "No special-act triggers detected in facts" },
    { label: "State Act(s) checked", checked: !!matter.jurisdiction.state, note: state.length > 0 ? state.map((a) => a.shortName).join(", ") : matter.jurisdiction.state ? "No state pack entries matched yet" : "Jurisdiction state not set" },
    { label: "Rules / Notifications reviewed", checked: false, note: "Not yet ingested for this domain — flag for manual research" },
    { label: "Case law searched", checked: caseLaw.length > 0, note: `${caseLaw.length} precedents in knowledge base (general corpus, not matter-specific)` },
    { label: "Limitation / deadlines computed", checked: deadlines.length > 0, note: deadlines.length > 0 ? `${deadlines.length} deadline(s) tracked` : "No deadlines computed yet" },
    { label: "Jurisdiction / forum confirmed", checked: !!matter.jurisdiction.court, note: matter.jurisdiction.court || "Forum not yet confirmed" },
    { label: "Central/State conflict check (Art. 254)", checked: !conflictFlag, note: conflictFlag || "No overlapping Central/State legislation detected" },
    { label: "Sensitivity classification set", checked: !!matter.sensitivityLevel, note: matter.sensitivityLevel },
  ];

  const scorePercent = Math.round((items.filter((i) => i.checked).length / items.length) * 100);

  return {
    matterId: matter.id,
    items,
    scorePercent,
    generatedAt: new Date().toISOString(),
  };
}
