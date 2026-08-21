/**
 * Typed repository layer on top of the local store. Route handlers and
 * server components should import from here, never from store.ts directly —
 * this is the seam where a future Supabase-backed implementation slots in
 * without touching call sites.
 */
import { COLLECTIONS, readCollection, insert, update, upsert, remove, findById } from "./store";
import type {
  Tenant, User, Act, Provision, CaseLaw, LegalRelationship, DocumentType,
  Matter, MatterParty, Draft, DraftCitation, ReviewAction, ChronologyEvent,
  Deadline, EvidenceItem, AuditLogEntry, ChatMessage,
} from "@/lib/types";

export const Tenants = {
  all: () => readCollection<Tenant>(COLLECTIONS.tenants),
  get: (id: string) => findById<Tenant>(COLLECTIONS.tenants, id),
};

export const Users = {
  all: () => readCollection<User>(COLLECTIONS.users),
  get: (id: string) => findById<User>(COLLECTIONS.users, id),
  byTenant: (tenantId: string) => readCollection<User>(COLLECTIONS.users).filter((u) => u.tenantId === tenantId),
};

export const Acts = {
  all: () => readCollection<Act>(COLLECTIONS.acts),
  get: (id: string) => findById<Act>(COLLECTIONS.acts, id),
  byDomain: (domain: string) => readCollection<Act>(COLLECTIONS.acts).filter((a) => a.domains.includes(domain as any)),
  byState: (state: string) => readCollection<Act>(COLLECTIONS.acts).filter((a) => a.state === state),
};

export const Provisions = {
  all: () => readCollection<Provision>(COLLECTIONS.provisions),
  get: (id: string) => findById<Provision>(COLLECTIONS.provisions, id),
  byAct: (actId: string) => readCollection<Provision>(COLLECTIONS.provisions).filter((p) => p.actId === actId),
  /** Point-in-time lookup — "what was the law on date X". */
  activeOn: (actId: string, date: string) =>
    readCollection<Provision>(COLLECTIONS.provisions).filter(
      (p) => p.actId === actId && p.validFrom <= date && (!p.validTo || p.validTo >= date) && !p.repealed
    ),
};

export const CaseLaws = {
  all: () => readCollection<CaseLaw>(COLLECTIONS.caseLaw),
  get: (id: string) => findById<CaseLaw>(COLLECTIONS.caseLaw, id),
};

export const LegalRelationships = {
  all: () => readCollection<LegalRelationship>(COLLECTIONS.legalRelationships),
  fromNode: (id: string) => readCollection<LegalRelationship>(COLLECTIONS.legalRelationships).filter((r) => r.fromId === id),
};

export const DocumentTypes = {
  all: () => readCollection<DocumentType>(COLLECTIONS.documentTypes),
  get: (id: string) => findById<DocumentType>(COLLECTIONS.documentTypes, id),
  byFamily: (family: string) => readCollection<DocumentType>(COLLECTIONS.documentTypes).filter((d) => d.family === family),
};

export const Matters = {
  all: () => readCollection<Matter>(COLLECTIONS.matters),
  get: (id: string) => findById<Matter>(COLLECTIONS.matters, id),
  byTenant: (tenantId: string) => readCollection<Matter>(COLLECTIONS.matters).filter((m) => m.tenantId === tenantId),
  create: (m: Matter) => insert(COLLECTIONS.matters, m),
  update: (id: string, patch: Partial<Matter>) => update<Matter>(COLLECTIONS.matters, id, patch),
};

export const MatterParties = {
  byMatter: (matterId: string) => readCollection<MatterParty>(COLLECTIONS.matterParties).filter((p) => p.matterId === matterId),
  create: (p: MatterParty) => insert(COLLECTIONS.matterParties, p),
};

export const Drafts = {
  all: () => readCollection<Draft>(COLLECTIONS.drafts),
  get: (id: string) => findById<Draft>(COLLECTIONS.drafts, id),
  byMatter: (matterId: string) => readCollection<Draft>(COLLECTIONS.drafts).filter((d) => d.matterId === matterId),
  create: (d: Draft) => insert(COLLECTIONS.drafts, d),
  update: (id: string, patch: Partial<Draft>) => update<Draft>(COLLECTIONS.drafts, id, patch),
  pendingReview: () => readCollection<Draft>(COLLECTIONS.drafts).filter((d) => d.status === "in_review" || d.status === "ai_generated"),
};

export const DraftCitations = {
  byDraft: (draftId: string) => readCollection<DraftCitation>(COLLECTIONS.draftCitations).filter((c) => c.draftId === draftId),
  create: (c: DraftCitation) => insert(COLLECTIONS.draftCitations, c),
  bulkCreate: (cs: DraftCitation[]) => cs.map((c) => insert(COLLECTIONS.draftCitations, c)),
};

export const ReviewActions = {
  byDraft: (draftId: string) => readCollection<ReviewAction>(COLLECTIONS.reviewActions).filter((r) => r.draftId === draftId),
  create: (r: ReviewAction) => insert(COLLECTIONS.reviewActions, r),
};

export const ChronologyEvents = {
  byMatter: (matterId: string) =>
    readCollection<ChronologyEvent>(COLLECTIONS.chronologyEvents)
      .filter((e) => e.matterId === matterId)
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
  create: (e: ChronologyEvent) => insert(COLLECTIONS.chronologyEvents, e),
};

export const Deadlines = {
  byMatter: (matterId: string) => readCollection<Deadline>(COLLECTIONS.deadlines).filter((d) => d.matterId === matterId),
  all: () => readCollection<Deadline>(COLLECTIONS.deadlines),
  create: (d: Deadline) => insert(COLLECTIONS.deadlines, d),
  update: (id: string, patch: Partial<Deadline>) => update<Deadline>(COLLECTIONS.deadlines, id, patch),
};

export const EvidenceItems = {
  byMatter: (matterId: string) => readCollection<EvidenceItem>(COLLECTIONS.evidenceItems).filter((e) => e.matterId === matterId),
  create: (e: EvidenceItem) => insert(COLLECTIONS.evidenceItems, e),
};

export const AuditLogs = {
  create: (a: AuditLogEntry) => insert(COLLECTIONS.auditLogs, a),
  byTenant: (tenantId: string) => readCollection<AuditLogEntry>(COLLECTIONS.auditLogs).filter((a) => a.tenantId === tenantId),
  all: () => readCollection<AuditLogEntry>(COLLECTIONS.auditLogs),
};

export const ChatMessages = {
  byMatter: (matterId: string) => readCollection<ChatMessage>(COLLECTIONS.chatMessages).filter((m) => m.matterId === matterId),
  create: (m: ChatMessage) => insert(COLLECTIONS.chatMessages, m),
};

export interface StateOnboardingRow {
  state: string;
  packStatus: "live" | "planned";
  actsSeeded: number;
  notes: string;
}
export const StateOnboarding = {
  all: () => readCollection<StateOnboardingRow>(COLLECTIONS.stateOnboarding),
};

export function logAudit(entry: Omit<AuditLogEntry, "id" | "createdAt">) {
  AuditLogs.create({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}
