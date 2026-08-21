/**
 * Manav Legal Solutions — Core Domain Types
 *
 * This file mirrors the Supabase schema in /supabase/migrations exactly, so the
 * local JSON data layer (lib/db) and a future real Postgres layer can share the
 * same TypeScript surface without churn. See docs/blueprint.md Section 6.
 */

// ─────────────────────────────────────────────────────────────────────────
// Jurisdiction & Taxonomy
// ─────────────────────────────────────────────────────────────────────────

export const INDIA_STATES_AND_UTS = [
  "Andaman & Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
  "Bihar", "Chandigarh", "Chhattisgarh", "Dadra & Nagar Haveli and Daman & Diu",
  "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh",
  "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
] as const;
export type IndiaStateOrUT = (typeof INDIA_STATES_AND_UTS)[number];

export type JurisdictionLevel = "union" | "state" | "district" | "local";

export interface Jurisdiction {
  level: JurisdictionLevel;
  state?: IndiaStateOrUT;
  district?: string;
  court?: string;
}

/** The ~30 top-level legal domains from the Master Taxonomy (source docs, Section 4). */
export const LEGAL_DOMAINS = [
  "constitutional", "criminal", "children_juvenile", "women_gender",
  "sc_st_social_justice", "human_rights", "motor_vehicle_transport", "taxation",
  "corporate_commercial", "insolvency_bankruptcy", "banking_financial",
  "securities_capital_markets", "intellectual_property", "cyber_digital",
  "data_protection", "labour_employment", "land_property", "environmental",
  "food_consumer", "real_estate", "education", "healthcare_medical",
  "agriculture", "trade_foreign_trade", "arbitration_adr",
  "administrative_service", "family_personal", "civil_general", "revenue_excise",
] as const;
export type LegalDomain = (typeof LEGAL_DOMAINS)[number];

export const LEGAL_DOMAIN_LABELS: Record<LegalDomain, string> = {
  constitutional: "Constitutional Law",
  criminal: "Criminal Law & Procedure",
  children_juvenile: "Children & Juvenile Justice",
  women_gender: "Women & Gender Justice",
  sc_st_social_justice: "SC/ST & Social Justice",
  human_rights: "Human Rights",
  motor_vehicle_transport: "Motor Vehicle / Transport (DTO-RTO)",
  taxation: "Taxation (Direct, GST, Customs, State)",
  corporate_commercial: "Corporate & Commercial",
  insolvency_bankruptcy: "Insolvency & Bankruptcy (IBC)",
  banking_financial: "Banking & Financial",
  securities_capital_markets: "Securities & Capital Markets",
  intellectual_property: "Intellectual Property",
  cyber_digital: "Cyber & Digital Law",
  data_protection: "Data Protection & Privacy",
  labour_employment: "Labour & Employment",
  land_property: "Land & Property",
  environmental: "Environmental Law",
  food_consumer: "Food Safety & Consumer Protection",
  real_estate: "Real Estate (RERA)",
  education: "Education Law",
  healthcare_medical: "Healthcare & Medical Law",
  agriculture: "Agriculture",
  trade_foreign_trade: "Trade & Foreign Trade",
  arbitration_adr: "Arbitration & ADR",
  administrative_service: "Constitutional / Administrative / Service Law",
  family_personal: "Family & Personal Law",
  civil_general: "Civil & General Law",
  revenue_excise: "Revenue & Excise",
};

/** Special-Act detection: narcotics, corruption, terrorism, etc. within criminal domain. */
export const SPECIAL_ACT_TAGS = [
  "ndps", "prevention_of_corruption", "pmla", "uapa", "arms_act",
  "explosives_act", "excise_prohibition", "pocso", "juvenile_justice",
  "domestic_violence", "dowry_prohibition", "sexual_harassment_workplace",
  "sc_st_atrocities", "rpwd", "motor_vehicles", "ndps_rules",
] as const;
export type SpecialActTag = (typeof SPECIAL_ACT_TAGS)[number];

// ─────────────────────────────────────────────────────────────────────────
// Legal Knowledge Base
// ─────────────────────────────────────────────────────────────────────────

export type TrustLevel = "A" | "B" | "C" | "D" | "E" | "F";

export const TRUST_LEVEL_LABELS: Record<TrustLevel, string> = {
  A: "Official primary authority (bare Act / India Code / e-Gazette)",
  B: "Official court material (SC/HC judgment, order)",
  C: "Authoritative regulatory material (ministry/regulator circular)",
  D: "Verified secondary legal material (reviewed digest)",
  E: "Internal firm material (drafting precedent, template)",
  F: "Unverified / public content — never cite in client-facing drafts",
};

export type ActStatus = "in_force" | "repealed" | "partially_repealed" | "not_yet_commenced";

export interface Act {
  id: string;
  shortName: string;          // "BNS", "Bihar Tenancy Act"
  fullName: string;
  jurisdictionLevel: "central" | "state" | "local";
  state?: IndiaStateOrUT;
  domains: LegalDomain[];
  specialActTags?: SpecialActTag[];
  status: ActStatus;
  enactedDate?: string;
  commencementDate?: string;
  repealedDate?: string;
  repealedBy?: string;        // act id
  sourceUrl: string;
  trustLevel: TrustLevel;
  competentAuthority?: string;
  specialCourt?: string;
  appealForum?: string;
  summary: string;
  coverageStatus: "seeded" | "stub" | "planned"; // honesty flag — see coverage engine
}

export type ProvisionKind =
  | "section" | "sub_section" | "clause" | "sub_clause" | "proviso"
  | "explanation" | "illustration" | "schedule" | "rule" | "sub_rule"
  | "regulation" | "notification" | "order";

export interface Provision {
  id: string;
  actId: string;
  chapter?: string;
  provisionKind: ProvisionKind;
  sectionNumber: string;      // "103", "63(4)"
  parentProvisionId?: string; // for clause->subsection->section nesting
  title: string;
  textContent: string;
  /** Point-in-time law versioning — the "bitemporal-lite" model. */
  validFrom: string;
  validTo?: string;           // null/undefined = currently in force
  repealed: boolean;
  amendedByProvisionId?: string;
  supersedesOldReference?: string; // e.g. "IPC s.302" for BNS s.103
  sourceUrl: string;
  trustLevel: TrustLevel;
  verifiedBy?: string;
  verifiedAt?: string;
}

export type PrecedentStatus = "binding" | "persuasive" | "overruled" | "distinguished" | "referred";

export interface CaseLaw {
  id: string;
  caseTitle: string;
  court: string;
  citation: string;
  decidedOn: string;
  holdingSummary: string;
  status: PrecedentStatus;
  relatedProvisionIds: string[];
  sourceUrl: string;
  trustLevel: TrustLevel;
}

/** A cross-reference edge in the legal relationship graph (Section 33/73 of research docs). */
export type LegalRelationType =
  | "amends" | "repeals" | "substitutes" | "references" | "implements"
  | "overrides" | "follows" | "distinguishes" | "overrules" | "applies_to"
  | "limits" | "extends" | "related_to";

export interface LegalRelationship {
  id: string;
  fromId: string;   // provision or case_law id
  toId: string;
  relation: LegalRelationType;
  note?: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Document Types & Drafting
// ─────────────────────────────────────────────────────────────────────────

export type DocumentFamily =
  | "notice" | "reply" | "complaint" | "application" | "petition"
  | "bail_application" | "affidavit" | "plaint" | "written_statement"
  | "appeal" | "revision" | "agreement" | "opinion" | "memo" | "chronology"
  | "checklist" | "representation" | "rti";

export interface DocumentTypeVariable {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select" | "party_list" | "currency";
  required: boolean;
  options?: string[];
  help?: string;
}

export interface DocumentType {
  id: string;
  name: string;
  family: DocumentFamily;
  domains: LegalDomain[];
  applicableJurisdictionLevels: ("central" | "state")[];
  variableSchema: DocumentTypeVariable[];
  templateSkeletonSections: string[]; // ordered mandatory section headings
  forum?: string;
  description: string;
}

export type DraftStatus = "ai_generated" | "in_review" | "approved" | "rejected" | "revision_requested";

export interface DraftCitation {
  id: string;
  draftId: string;
  provisionId?: string;
  caseLawId?: string;
  citedText: string;
  verificationStatus: "verified" | "unverified" | "flagged";
  flagReason?: string;
}

export interface Draft {
  id: string;
  matterId: string;
  documentTypeId: string;
  title: string;
  content: string;              // markdown
  variables: Record<string, string>;
  status: DraftStatus;
  generatedBy: string;          // agent name
  coverageScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewAction {
  id: string;
  draftId: string;
  reviewerId: string;
  action: "approve" | "edit" | "reject" | "request_revision";
  notes?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Case / Matter Operations
// ─────────────────────────────────────────────────────────────────────────

export type MatterStatus = "intake" | "research" | "drafting" | "review" | "filed" | "closed";
export type SensitivityLevel = "standard" | "restricted"; // POCSO/JJ/DV get 'restricted'

export interface MatterParty {
  id: string;
  matterId: string;
  role: "client" | "petitioner" | "respondent" | "witness" | "opposite_party" | "third_party";
  fullName: string;
  personType?: "individual" | "company" | "government" | "minor" | "woman" | "senior_citizen" | "organisation" | "foreign_entity";
  address?: string;
  contact?: { phone?: string; email?: string };
}

export interface Matter {
  id: string;
  tenantId: string;
  clientId?: string;
  title: string;
  status: MatterStatus;
  domains: LegalDomain[];
  specialActTags?: SpecialActTag[];
  jurisdiction: Jurisdiction;
  sensitivityLevel: SensitivityLevel;
  facts: string;
  reliefSought?: string;
  caseNumber?: string;
  cnr?: string;
  assignedAdvocateId?: string;
  assignedParalegalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChronologyEvent {
  id: string;
  matterId: string;
  eventDate: string;
  description: string;
  person?: string;
  relatedDocumentId?: string;
  relatedProvisionId?: string;
  evidenceRef?: string;
  courtAction?: string;
  nextAction?: string;
  source: "ai_extracted" | "manual";
}

export type DeadlineSource = "ai_estimated" | "lawyer_verified";

export interface Deadline {
  id: string;
  matterId: string;
  label: string;
  dueDate: string;
  basis: string;          // e.g. "Limitation Act 1963, Art. 137"
  source: DeadlineSource;
  status: "pending" | "met" | "missed" | "extended";
}

// Document/evidence upload types are superseded by DocumentRecord and
// DocumentChunkRecord in lib/db/documents-repo.ts (the real RAG pipeline's
// object model — parsed structure, chunks, embeddings, source metadata).

// ─────────────────────────────────────────────────────────────────────────
// Users, Tenancy, Audit
// ─────────────────────────────────────────────────────────────────────────

export type UserRole = "platform_admin" | "firm_admin" | "advocate" | "paralegal" | "client";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  branding: { primaryColor?: string; logoText?: string };
  stateAnchor?: IndiaStateOrUT;
  createdAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  fullName: string;
  role: UserRole;
  languagePref: "en" | "hi" | "bilingual";
  email?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Consultation (Mode A) / Chat
// ─────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  matterId?: string;
  role: "user" | "assistant" | "system";
  content: string;
  citedProvisionIds?: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────
// "What Laws May Apply?" Engine output
// ─────────────────────────────────────────────────────────────────────────

export interface ApplicableLawRow {
  category: string;          // "General Criminal", "Special Act", "State Law", "Procedure", "Evidence", "Court"
  law: string;                // display name
  actId?: string;
  provisionIds?: string[];
  reason: string;
  confidence: "high" | "medium" | "low";
  verified: boolean;
}

export interface LegalCoverageAudit {
  matterId: string;
  items: { label: string; checked: boolean; note?: string }[];
  scorePercent: number;
  generatedAt: string;
}
