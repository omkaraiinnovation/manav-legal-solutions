import type { IndiaStateOrUT, Jurisdiction, LegalDomain } from "@/lib/types";
import { Acts } from "@/lib/db/repo";

export const STATE_PACK_STATUS: Record<string, "live" | "planned"> = {
  Bihar: "live",
};

export function statePackStatus(state?: IndiaStateOrUT): "live" | "planned" | "unspecified" {
  if (!state) return "unspecified";
  return STATE_PACK_STATUS[state] ?? "planned";
}

/** Courts commonly relevant per domain — a simplified Court Hierarchy Engine (docs Section 38-39). */
export const SPECIAL_COURT_MAP: Partial<Record<string, string>> = {
  pocso: "POCSO Special Court (designated Sessions Court)",
  ndps: "NDPS Special Court",
  prevention_of_corruption: "Special Judge (Prevention of Corruption Act) Court",
  pmla: "PMLA Special Court",
  uapa: "NIA Special Court / designated Sessions Court",
  sc_st_atrocities: "Special Court under the SC/ST (Prevention of Atrocities) Act",
};

export function suggestForum(domains: LegalDomain[], specialActTags: string[] = []): string[] {
  const forums = new Set<string>();
  for (const tag of specialActTags) {
    const f = SPECIAL_COURT_MAP[tag];
    if (f) forums.add(f);
  }
  if (domains.includes("family_personal")) forums.add("Family Court");
  if (domains.includes("food_consumer")) forums.add("Consumer Commission (District/State/National by pecuniary value)");
  if (domains.includes("labour_employment")) forums.add("Labour Court / Industrial Tribunal");
  if (domains.includes("insolvency_bankruptcy")) forums.add("NCLT / NCLAT");
  if (domains.includes("banking_financial")) forums.add("Debts Recovery Tribunal (if secured-debt enforcement)");
  if (domains.includes("real_estate")) forums.add("State RERA Authority / Appellate Tribunal");
  if (domains.includes("environmental")) forums.add("National Green Tribunal");
  if (domains.includes("securities_capital_markets")) forums.add("Securities Appellate Tribunal");
  if (domains.includes("arbitration_adr") || domains.includes("corporate_commercial")) forums.add("Commercial Court / Arbitral Tribunal");
  if (forums.size === 0) forums.add("District / Magistrate Court (general jurisdiction) — to be confirmed by reviewing advocate");
  return [...forums];
}

/** Resolves candidate central + state Acts for a jurisdiction + domain set — the core of the
 *  "never assume a Central Act operates in isolation" rule. */
export async function resolveApplicableActs(jurisdiction: Jurisdiction, domains: LegalDomain[]) {
  const all = await Acts.all();
  const central = all.filter((a) => a.jurisdictionLevel === "central" && a.domains.some((d) => domains.includes(d)));
  const state = jurisdiction.state
    ? all.filter((a) => a.jurisdictionLevel === "state" && a.state === jurisdiction.state && a.domains.some((d) => domains.includes(d)))
    : [];
  const conflictFlag =
    central.length > 0 && state.length > 0
      ? "Both Central and State legislation are potentially engaged in the same domain — resolve precedence under Article 254 (Doctrine of Repugnancy) before drafting. Do not assume Central law automatically prevails: check whether the State Act received Presidential assent under Art. 254(2)."
      : undefined;
  return { central, state, conflictFlag };
}
