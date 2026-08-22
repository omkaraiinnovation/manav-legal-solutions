/**
 * Verification / Citation Agent — the Legal Claim Firewall (source docs Section
 * 49; Blueprint 4.4). Non-negotiable: runs on every draft before it reaches a
 * human reviewer. Checks each citation against the `provisions` and
 * `case_law` tables; anything unmatched is flagged, never silently dropped or
 * silently trusted.
 */
import { Acts, Provisions, CaseLaws } from "@/lib/db/repo";
import type { DraftCitation } from "@/lib/types";
import type { JudgmentResult } from "./judgment-research-agent";

export interface VerificationFinding {
  citedText: string;
  provisionId?: string;
  caseLawId?: string;
  verificationStatus: DraftCitation["verificationStatus"];
  flagReason?: string;
}

const CITATION_PATTERN = /\b(?:Section|S\.|s\.)\s?(\d+[A-Za-z]?(?:\(\d+\))?)\s*,?\s*([A-Za-z][A-Za-z .,'&]{2,40}?(?:Act|Sanhita|Adhiniyam|Code|Constitution))\b/g;
const EXPLICIT_FLAG_PATTERN = /\[VERIFICATION REQUIRED[^\]]*\]/g;
/** Loosely matches "Party Name v. Other Party" / "vs." case-name mentions, to catch
 *  citations the drafting agent produced that aren't in the known-case checks below. */
const CASE_NAME_PATTERN = /\b([A-Z][A-Za-z.&' ]{2,60}?)\s+v\.?s?\.?\s+([A-Z][A-Za-z.&' ]{2,60}?)(?=[,.\n(]|$)/g;

/** `liveJudgments`: the real, source-linked judgments a live judicial-research pass actually
 *  offered the drafting agent for this draft (spec §20 "citation accuracy... unsupported legal
 *  propositions"). A case name the draft cites that appears here is confirmed against a real
 *  search result, not just trusted; one that appears in neither this list nor the seeded
 *  case_law table is flagged as an unconfirmed citation rather than silently accepted. */
export async function runVerificationPass(draftContent: string, liveJudgments: JudgmentResult[] = []): Promise<{ findings: VerificationFinding[]; passRate: number }> {
  const findings: VerificationFinding[] = [];
  const [acts, provisions, caseLaw] = await Promise.all([Acts.all(), Provisions.all(), CaseLaws.all()]);

  // 1. Anything the drafting agent already self-flagged is recorded as flagged, not re-guessed.
  const explicitFlags = draftContent.match(EXPLICIT_FLAG_PATTERN) ?? [];
  for (const flag of explicitFlags) {
    findings.push({ citedText: flag, verificationStatus: "flagged", flagReason: "Drafting agent could not verify this against the knowledge base." });
  }

  // 2. Every "Section X, <Act>" style citation must resolve to a real Act + Provision row.
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = CITATION_PATTERN.exec(draftContent)) !== null) {
    const [full, sectionNum, actNameRaw] = match;
    if (seen.has(full)) continue;
    seen.add(full);
    const actNameNorm = actNameRaw.trim().toLowerCase();
    const act = acts.find(
      (a) => actNameNorm.includes(a.shortName.toLowerCase()) || a.shortName.toLowerCase().includes(actNameNorm.split(" ")[0])
    );
    if (!act) {
      findings.push({ citedText: full, verificationStatus: "flagged", flagReason: `No Act in the knowledge base matches "${actNameRaw.trim()}" — resolve to [VERIFICATION REQUIRED] before this reaches a client.` });
      continue;
    }
    const provision = provisions.find((p) => p.actId === act.id && p.sectionNumber.replace(/\s/g, "") === sectionNum.replace(/\s/g, ""));
    if (!provision) {
      findings.push({ citedText: full, provisionId: undefined, verificationStatus: "unverified", flagReason: `${act.shortName} s.${sectionNum} is not yet ingested in the seeded knowledge base — Act exists (trust level ${act.trustLevel}) but this specific section has not been verified.` });
      continue;
    }
    if (provision.repealed) {
      findings.push({ citedText: full, provisionId: provision.id, verificationStatus: "flagged", flagReason: `${act.shortName} s.${sectionNum} is REPEALED (valid ${provision.validFrom} to ${provision.validTo}). Confirm the event date before citing — this may be the correct historical citation, or may need updating to its successor provision.` });
      continue;
    }
    findings.push({ citedText: full, provisionId: provision.id, verificationStatus: "verified" });
  }

  // 3. Case-name mentions are checked against the case_law table (LEPHANTOMCITE-lite, source docs Section 53).
  for (const cl of caseLaw) {
    const shortTitle = cl.caseTitle.split(" v. ")[0];
    if (draftContent.includes(shortTitle) && !draftContent.includes(cl.citation)) {
      findings.push({ citedText: shortTitle, caseLawId: cl.id, verificationStatus: "flagged", flagReason: `"${shortTitle}" is referenced without its citation (${cl.citation}). Add the full citation before filing — uncited case names are a common hallucination vector.` });
    } else if (draftContent.includes(cl.citation)) {
      findings.push({ citedText: cl.citation, caseLawId: cl.id, verificationStatus: cl.status === "overruled" ? "flagged" : "verified", flagReason: cl.status === "overruled" ? `${cl.caseTitle} is flagged as ${cl.status} — do not rely on this as current law.` : undefined });
    }
  }

  // 4. Case names offered to the drafting agent by live judicial research (spec §20): if the
  //    draft actually cited one, that's a real, source-linked confirmation, not a guess — record
  //    it as verified with the source URL so the reviewer can open the original judgment directly.
  const confirmedCaseNames = new Set<string>();
  for (const j of liveJudgments) {
    const shortTitle = j.caseTitle.split(/\s+v\.?s?\.?\s+/i)[0].trim();
    if (shortTitle.length > 3 && draftContent.includes(shortTitle)) {
      confirmedCaseNames.add(shortTitle.toLowerCase());
      findings.push({
        citedText: j.caseTitle, verificationStatus: "verified",
        flagReason: `Confirmed via live judicial research (${j.courtName}${j.citation ? `, ${j.citation}` : ""}): ${j.sourceUrl}`,
      });
    }
  }

  // 5. Any other "X v. Y"-shaped case name in the draft that matches neither the seeded case_law
  //    table nor a live research result is an unconfirmed citation — flagged, not trusted, since an
  //    unconfirmed case name is exactly how a fabricated precedent would look.
  const knownShortTitles = new Set(caseLaw.map((cl) => cl.caseTitle.split(" v. ")[0].toLowerCase()));
  let caseMatch: RegExpExecArray | null;
  const seenCaseNames = new Set<string>();
  while ((caseMatch = CASE_NAME_PATTERN.exec(draftContent)) !== null) {
    const full = caseMatch[0].trim();
    const partyOne = caseMatch[1].trim();
    const key = partyOne.toLowerCase();
    if (seenCaseNames.has(key) || full.length > 90) continue; // avoid re-flagging the same name twice or matching unrelated prose
    seenCaseNames.add(key);
    if (knownShortTitles.has(key) || confirmedCaseNames.has(key)) continue; // already handled by an earlier pass
    findings.push({
      citedText: full, verificationStatus: "unverified",
      flagReason: `"${full}" does not match any judgment in the seeded knowledge base or this draft's live judicial research results — confirm this citation independently before relying on it.`,
    });
  }

  const verifiedCount = findings.filter((f) => f.verificationStatus === "verified").length;
  const passRate = findings.length === 0 ? 100 : Math.round((verifiedCount / findings.length) * 100);
  return { findings, passRate };
}
