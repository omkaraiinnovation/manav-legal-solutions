/**
 * Applicable-Law Agent — "What Laws May Apply?" (source docs, Section 46 / Blueprint 3.3).
 *
 * Deterministic in both live and mock mode: the candidate sweep always comes
 * from the Special-Act Detection Engine (lib/legal/taxonomy) run against the
 * seeded knowledge base, so results are grounded and reproducible. In live
 * mode, an LLM pass is added on top purely to write the natural-language
 * "reason" column in the advocate's preferred phrasing — it cannot introduce
 * a law that the deterministic sweep didn't already surface.
 */
import type { ApplicableLawRow, Jurisdiction, LegalDomain } from "@/lib/types";
import { detectApplicableAreas } from "@/lib/legal/taxonomy";
import { resolveApplicableActs, suggestForum, statePackStatus } from "@/lib/legal/jurisdiction";
import { Acts } from "@/lib/db/repo";

export interface ApplicableLawResult {
  rows: ApplicableLawRow[];
  suggestedDomains: LegalDomain[];
  suggestedForums: string[];
  conflictFlag?: string;
  statePackNote: string;
}

export async function runApplicableLawSweep(facts: string, jurisdiction: Jurisdiction, knownDomains: LegalDomain[] = []): Promise<ApplicableLawResult> {
  const detections = detectApplicableAreas(facts);
  const suggestedDomains = [...new Set([...knownDomains, ...detections.map((d) => d.domain)])];
  const [{ central, state, conflictFlag }, allActs] = await Promise.all([
    resolveApplicableActs(jurisdiction, suggestedDomains),
    Acts.all(),
  ]);
  const rows: ApplicableLawRow[] = [];

  // Always run the general-criminal / civil baseline
  const criminalAct = allActs.find((a) => a.id === "act-bns-2023");
  if (suggestedDomains.includes("criminal") || detections.length === 0) {
    if (criminalAct) {
      rows.push({
        category: "General Criminal",
        law: criminalAct.shortName + " (successor to IPC, 1860)",
        actId: criminalAct.id,
        reason: "Baseline criminal-law screen applied to every matter with a possible offence element.",
        confidence: suggestedDomains.includes("criminal") ? "high" : "low",
        verified: true,
      });
    }
  }

  for (const d of detections) {
    const act = allActs.find((a) => a.shortName.toLowerCase().includes(d.actShortName.toLowerCase().split(" ")[0].toLowerCase()));
    rows.push({
      category: d.specialActTag ? "Special Act" : "Domain Law",
      law: d.actShortName,
      actId: act?.id,
      reason: d.reason + (d.matchedText.length ? ` (matched: "${d.matchedText.join('", "')}")` : ""),
      confidence: "medium",
      verified: !!act,
    });
  }

  for (const a of state) {
    rows.push({
      category: "State Law",
      law: `${a.shortName} (${jurisdiction.state})`,
      actId: a.id,
      reason: `${jurisdiction.state}-specific legislation in a matching domain — evaluated because jurisdiction.state = "${jurisdiction.state}".`,
      confidence: "medium",
      verified: true,
    });
  }

  // Procedure + Evidence — always surfaced for anything with a criminal/civil litigation element
  if (suggestedDomains.some((d) => d === "criminal")) {
    rows.push({ category: "Procedure", law: "BNSS, 2023 (successor to CrPC, 1973)", actId: "act-bnss-2023", reason: "Criminal-procedure framework applies to any prosecutable matter.", confidence: "high", verified: true });
    rows.push({ category: "Evidence", law: "BSA, 2023 (successor to Evidence Act, 1872)", actId: "act-bsa-2023", reason: "Evidence-law framework applies to any matter that may reach trial.", confidence: "high", verified: true });
  }
  if (suggestedDomains.some((d) => d === "civil_general" || d === "land_property" || d === "corporate_commercial")) {
    rows.push({ category: "Procedure", law: "Code of Civil Procedure, 1908", actId: "act-cpc-1908", reason: "Civil-procedure framework applies to any suit-based matter.", confidence: "high", verified: true });
  }

  const forums = suggestForum(suggestedDomains, detections.map((d) => d.specialActTag).filter(Boolean) as string[]);
  for (const f of forums) {
    rows.push({ category: "Court / Forum", law: f, reason: "Forum suggested from domain + special-act signals — confirm territorial and pecuniary jurisdiction before filing.", confidence: "medium", verified: false });
  }

  const packStatus = statePackStatus(jurisdiction.state);
  const statePackNote =
    packStatus === "live"
      ? `${jurisdiction.state} State Legal Pack is live — state-law rows above are checked against seeded content.`
      : packStatus === "planned"
        ? `${jurisdiction.state} State Legal Pack is not yet seeded (Phase 4+ roadmap). State-specific rows are NOT included — flag for manual research before advising on state law.`
        : "No jurisdiction.state set — state-law sweep skipped entirely. Set the matter's state to enable it.";

  return { rows, suggestedDomains, suggestedForums: forums, conflictFlag, statePackNote };
}
