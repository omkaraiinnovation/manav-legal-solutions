/**
 * The Special-Act Detection Engine (source docs, Section 30).
 *
 * Deliberately simple and auditable: a keyword/pattern ruleset over the fact
 * narrative that proposes candidate domains + special acts for a matter. This
 * is NOT a substitute for a trained legal-NLP classifier (InLegalBERT etc. —
 * see docs/blueprint.md Phase 4+) but it demonstrates the exact behaviour the
 * research docs specify: a fact pattern about a child never returns only the
 * general criminal code, it also surfaces POCSO/JJ Act candidates for the
 * advocate to confirm or dismiss. Every match is a *proposal* — nothing here
 * is presented as verified law; that happens downstream in the Applicable-Law
 * Agent + Verification Agent.
 */
import type { LegalDomain, SpecialActTag } from "@/lib/types";

export interface DetectionRule {
  id: string;
  domain: LegalDomain;
  specialActTag?: SpecialActTag;
  actShortName: string;
  patterns: RegExp[];
  reason: string;
}

const RULES: DetectionRule[] = [
  { id: "r-minor", domain: "children_juvenile", specialActTag: "pocso", actShortName: "POCSO Act, 2012", patterns: [/\bminor\b/i, /\bchild(ren)?\b/i, /\bjuvenile\b/i, /\b(1[0-7])\s*[- ]?year/i, /\bschool[- ]?going\b/i], reason: "Facts reference a minor/child — POCSO and Juvenile Justice frameworks must be evaluated alongside general criminal law, never in isolation." },
  { id: "r-minor-jj", domain: "children_juvenile", specialActTag: "juvenile_justice", actShortName: "Juvenile Justice Act, 2015", patterns: [/\bminor\b/i, /\bjuvenile\b/i, /\bchild in conflict\b/i], reason: "A minor is involved — Juvenile Justice Board / Child Welfare Committee jurisdiction may apply." },
  { id: "r-assault-sexual", domain: "women_gender", specialActTag: undefined, actShortName: "BNS — sexual offence provisions", patterns: [/\bassault(ed)?\b/i, /molest/i, /sexual(ly)?\b/i, /outrag(e|ing) (her |the )?modesty/i], reason: "Facts describe an assault with a possible sexual element — BNS ss.74-79 (successor to IPC ss.354/354A/509) should be evaluated." },
  { id: "r-dowry", domain: "women_gender", specialActTag: "dowry_prohibition", actShortName: "Dowry Prohibition Act, 1961", patterns: [/\bdowry\b/i], reason: "Dowry mentioned — Dowry Prohibition Act plus BNS ss.80 (dowry death) / 85 (cruelty) apply." },
  { id: "r-domestic-violence", domain: "women_gender", specialActTag: "domestic_violence", actShortName: "Protection of Women from Domestic Violence Act, 2005", patterns: [/domestic violence/i, /\bcruelty\b/i, /husband.*(beat|hit|abuse)/i, /in-?laws?.*(harass|abuse)/i], reason: "Facts describe domestic violence/cruelty — PWDVA civil remedies run alongside any BNS criminal complaint." },
  { id: "r-workplace-harassment", domain: "women_gender", specialActTag: "sexual_harassment_workplace", actShortName: "POSH Act, 2013", patterns: [/workplace.*harass/i, /\bPOSH\b/i, /internal committee/i], reason: "Workplace sexual harassment indicated — POSH Act internal-committee process applies." },
  { id: "r-narcotics", domain: "criminal", specialActTag: "ndps", actShortName: "NDPS Act, 1985", patterns: [/\bnarcotic/i, /\bdrugs?\b/i, /\bganja\b/i, /\bcharas\b/i, /\bpsychotropic\b/i, /\bpeddl(er|ing)\b/i], reason: "Narcotics/drugs referenced — NDPS Act (search/seizure/sampling/chain-of-custody rules) applies alongside general criminal law." },
  { id: "r-corruption", domain: "criminal", specialActTag: "prevention_of_corruption", actShortName: "Prevention of Corruption Act, 1988", patterns: [/\bbribe/i, /\bcorruption\b/i, /public servant.*(gratification|bribe)/i], reason: "Bribery of a public servant referenced — Prevention of Corruption Act applies; note the s.17A prior-sanction requirement." },
  { id: "r-money-laundering", domain: "criminal", specialActTag: "pmla", actShortName: "PMLA, 2002", patterns: [/money laundering/i, /proceeds of crime/i, /\bhawala\b/i], reason: "Proceeds-of-crime / laundering indicated — PMLA applies alongside the predicate offence." },
  { id: "r-excise", domain: "revenue_excise", specialActTag: "excise_prohibition", actShortName: "Bihar Prohibition & Excise Act, 2016", patterns: [/\balcohol\b/i, /\bliquor\b/i, /\bcountry made\b/i, /\bprohibition\b/i], reason: "Alcohol/liquor referenced — in Bihar, the Prohibition & Excise Act's presumption-of-guilt regime (s.32) applies." },
  { id: "r-arms", domain: "criminal", specialActTag: "arms_act", actShortName: "Arms Act, 1959", patterns: [/\bfirearm\b/i, /\bpistol\b/i, /\bcountry[- ]made (gun|pistol)\b/i, /\billegal (arm|weapon)/i], reason: "Firearm/weapon referenced — Arms Act licensing/possession offences apply." },
  { id: "r-motor-accident", domain: "motor_vehicle_transport", specialActTag: "motor_vehicles", actShortName: "Motor Vehicles Act, 1988", patterns: [/\baccident\b/i, /\bvehicle\b/i, /\bcollision\b/i, /\bhit[- ]and[- ]run\b/i, /\bdriving licen[sc]e\b/i], reason: "Vehicle/accident referenced — Motor Vehicles Act plus MACT compensation jurisdiction and possible BNS s.106 (death by negligence) apply." },
  { id: "r-cheque", domain: "banking_financial", actShortName: "Negotiable Instruments Act, 1881", patterns: [/\bcheque\b/i, /\bdishono(u)?r/i, /\bbounce/i], reason: "Cheque dishonour referenced — NI Act s.138/s.142 complaint route applies." },
  { id: "r-property", domain: "land_property", actShortName: "Transfer of Property Act / State land laws", patterns: [/\bland\b/i, /\btenant(s|cy)?\b/i, /\blandlord\b/i, /\beviction\b/i, /\bkhatian\b/i, /\bmutation\b/i, /\brent(al|ed)?\b/i, /\blease\b/i, /\bsecurity deposit\b/i, /\bpossession\b/i, /\bencroach(ment|ing)?\b/i, /\bvacate\b/i], reason: "Property/tenancy facts — Central Transfer of Property Act plus the relevant State's land/tenancy/rent-control Acts apply together, never Central law alone." },
  { id: "r-cyber", domain: "cyber_digital", actShortName: "Information Technology Act, 2000", patterns: [/\bonline\b/i, /\bhack(ed|ing)?\b/i, /\bphishing\b/i, /\bOTP\b/i, /\bsocial media\b/i, /\bcyber\b/i, /\belectronic (record|evidence)\b/i], reason: "Cyber/digital element referenced — IT Act plus BSA ss.61-63 (electronic evidence admissibility) apply." },
  { id: "r-data", domain: "data_protection", actShortName: "DPDP Act, 2023", patterns: [/personal data/i, /data (leak|breach)/i, /customer data/i], reason: "Personal-data handling referenced — Digital Personal Data Protection Act, 2023 obligations may apply alongside criminal/contractual claims." },
  { id: "r-employment", domain: "labour_employment", actShortName: "Labour Codes, 2020 / erstwhile labour Acts", patterns: [/\btermination\b/i, /\bgratuity\b/i, /\bprovident fund\b/i, /\bemployee\b/i, /\bwages?\b/i, /\btermina(ted|tion)\b/i], reason: "Employment facts — applicable Labour Code / erstwhile labour statute + any State-specific Shops & Establishments Rules apply." },
  { id: "r-consumer", domain: "food_consumer", actShortName: "Consumer Protection Act, 2019", patterns: [/\bdefective\b/i, /\bdeficien(t|cy) (of|in) service\b/i, /\bwarranty\b/i, /\brefund\b/i], reason: "Deficient goods/service referenced — Consumer Protection Act, 2019 complaint route applies." },
  { id: "r-tax", domain: "taxation", actShortName: "Income-tax Act / GST Acts", patterns: [/\bincome tax\b/i, /\bGST\b/i, /\btax notice\b/i, /\bassessment order\b/i], reason: "Tax matter referenced — Income-tax Act or GST Acts (plus applicable Rules/Circulars) apply depending on the tax head." },
  { id: "r-scst", domain: "sc_st_social_justice", specialActTag: "sc_st_atrocities", actShortName: "SC/ST (Prevention of Atrocities) Act, 1989", patterns: [/\bcaste\b/i, /\bSC\/ST\b/i, /scheduled caste/i, /scheduled tribe/i], reason: "Caste-based facts referenced — SC/ST (Prevention of Atrocities) Act special-court procedure and enhanced protections apply." },
  { id: "r-environment", domain: "environmental", actShortName: "Environment (Protection) Act / NGT Act", patterns: [/\bpollution\b/i, /\beffluent\b/i, /\bhazardous waste\b/i, /\bdeforestation\b/i], reason: "Environmental facts referenced — Environment (Protection) Act / NGT jurisdiction applies." },
  { id: "r-ip", domain: "intellectual_property", actShortName: "Trade Marks Act / Copyright Act / Patents Act", patterns: [/\btrademark\b/i, /\bcopyright\b/i, /\bpatent\b/i, /\bcounterfeit\b/i, /\bpassing off\b/i], reason: "IP facts referenced — relevant IP statute (Trade Marks/Copyright/Patents) applies." },
];

export interface DetectionResult {
  ruleId: string;
  domain: LegalDomain;
  specialActTag?: SpecialActTag;
  actShortName: string;
  reason: string;
  matchedText: string[];
}

export function detectApplicableAreas(factsText: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  for (const rule of RULES) {
    const matched: string[] = [];
    for (const pattern of rule.patterns) {
      const m = factsText.match(pattern);
      if (m) matched.push(m[0]);
    }
    if (matched.length > 0) {
      results.push({
        ruleId: rule.id,
        domain: rule.domain,
        specialActTag: rule.specialActTag,
        actShortName: rule.actShortName,
        reason: rule.reason,
        matchedText: [...new Set(matched)],
      });
    }
  }
  return results;
}

export { RULES as DETECTION_RULES };
