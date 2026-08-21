/**
 * Typed, async repository layer over Supabase Postgres. Every function here
 * runs through the caller's own RLS-scoped session (see lib/supabase/server.ts)
 * — there is no service-role bypass anywhere in this app. Route handlers and
 * Server Components should import from here, never call supabase-js directly,
 * so the snake_case <-> camelCase mapping stays in one place.
 */
import { createClient } from "@/lib/supabase/server";
import type {
  Tenant, User, Act, Provision, CaseLaw, LegalRelationship, DocumentType,
  Matter, MatterParty, Draft, DraftCitation, ReviewAction, ChronologyEvent,
  Deadline, AuditLogEntry, ChatMessage, LegalDomain, TrustLevel, ActStatus,
} from "@/lib/types";

// ── mappers: snake_case DB row -> camelCase domain type ────────────────────

function mapAct(r: any): Act {
  return {
    id: r.id, shortName: r.short_name, fullName: r.full_name,
    jurisdictionLevel: r.jurisdiction_level, state: r.state ?? undefined,
    domains: r.domains ?? [], specialActTags: r.special_act_tags ?? undefined,
    status: r.status as ActStatus, enactedDate: r.enacted_date ?? undefined,
    commencementDate: r.commencement_date ?? undefined, repealedDate: r.repealed_date ?? undefined,
    repealedBy: r.repealed_by ?? undefined, sourceUrl: r.source_url, trustLevel: r.trust_level as TrustLevel,
    competentAuthority: r.competent_authority ?? undefined, specialCourt: r.special_court ?? undefined,
    appealForum: r.appeal_forum ?? undefined, summary: r.summary ?? "",
    coverageStatus: (r.coverage_status ?? "planned") as Act["coverageStatus"],
  };
}
function mapProvision(r: any): Provision {
  return {
    id: r.id, actId: r.act_id, chapter: r.chapter ?? undefined, provisionKind: r.provision_kind,
    sectionNumber: r.section_number, parentProvisionId: r.parent_provision_id ?? undefined,
    title: r.title ?? "", textContent: r.text_content ?? "", validFrom: r.valid_from,
    validTo: r.valid_to ?? undefined, repealed: !!r.repealed, amendedByProvisionId: r.amended_by_provision_id ?? undefined,
    supersedesOldReference: r.supersedes_old_reference ?? undefined, sourceUrl: r.source_url,
    trustLevel: r.trust_level as TrustLevel, verifiedBy: r.verified_by ?? undefined, verifiedAt: r.verified_at ?? undefined,
  };
}
function mapCaseLaw(r: any): CaseLaw {
  return {
    id: r.id, caseTitle: r.case_title, court: r.court ?? "", citation: r.citation ?? "",
    decidedOn: r.decided_on ?? "", holdingSummary: r.holding_summary ?? "", status: r.status,
    relatedProvisionIds: r.related_provision_ids ?? [], sourceUrl: r.source_url, trustLevel: r.trust_level as TrustLevel,
  };
}
function mapDocType(r: any): DocumentType {
  return {
    id: r.id, name: r.name, family: r.family, domains: r.domains ?? [],
    applicableJurisdictionLevels: (r.applicable_jurisdiction_levels ?? []) as DocumentType["applicableJurisdictionLevels"],
    variableSchema: r.variable_schema ?? [], templateSkeletonSections: r.template_skeleton_sections ?? [],
    forum: r.forum ?? undefined, description: r.description ?? "",
  };
}
function mapMatter(r: any): Matter {
  return {
    id: r.id, tenantId: r.tenant_id, clientId: r.client_id ?? undefined, title: r.title,
    status: r.status, domains: r.domains ?? [], specialActTags: r.special_act_tags ?? undefined,
    jurisdiction: r.jurisdiction ?? { level: "state" }, sensitivityLevel: r.sensitivity_level,
    facts: r.facts ?? "", reliefSought: r.relief_sought ?? undefined, caseNumber: r.case_number ?? undefined,
    cnr: r.cnr ?? undefined, assignedAdvocateId: r.assigned_advocate_id ?? undefined,
    assignedParalegalId: r.assigned_paralegal_id ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapMatterParty(r: any): MatterParty {
  return { id: r.id, matterId: r.matter_id, role: r.role, fullName: r.full_name, personType: r.person_type ?? undefined, address: r.address ?? undefined, contact: r.contact ?? undefined };
}
function mapDraft(r: any): Draft {
  return {
    id: r.id, matterId: r.matter_id, documentTypeId: r.document_type_id, title: r.title ?? "",
    content: r.content ?? "", variables: r.variables ?? {}, status: r.status, generatedBy: r.generated_by ?? "drafting_agent",
    coverageScore: r.coverage_score ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapDraftCitation(r: any): DraftCitation {
  return { id: r.id, draftId: r.draft_id, provisionId: r.provision_id ?? undefined, caseLawId: r.case_law_id ?? undefined, citedText: r.cited_text ?? "", verificationStatus: r.verification_status, flagReason: r.flag_reason ?? undefined };
}
function mapReviewAction(r: any): ReviewAction {
  return { id: r.id, draftId: r.draft_id, reviewerId: r.reviewer_id, action: r.action, notes: r.notes ?? undefined, createdAt: r.created_at };
}
function mapChronology(r: any): ChronologyEvent {
  return { id: r.id, matterId: r.matter_id, eventDate: r.event_date, description: r.description ?? "", person: r.person ?? undefined, relatedDocumentId: r.related_document_id ?? undefined, relatedProvisionId: r.related_provision_id ?? undefined, evidenceRef: r.evidence_ref ?? undefined, courtAction: r.court_action ?? undefined, nextAction: r.next_action ?? undefined, source: r.source };
}
function mapDeadline(r: any): Deadline {
  return { id: r.id, matterId: r.matter_id, label: r.label ?? "", dueDate: r.due_date, basis: r.basis ?? "", source: r.source, status: r.status };
}
function mapUser(r: any): User {
  return { id: r.id, tenantId: r.tenant_id ?? "", fullName: r.full_name ?? "", role: r.role, languagePref: r.language_pref ?? "en", email: r.email ?? undefined, createdAt: r.created_at };
}
function mapTenant(r: any): Tenant {
  return { id: r.id, name: r.name, slug: r.slug, branding: r.branding ?? {}, stateAnchor: r.state_anchor ?? undefined, createdAt: r.created_at };
}

// ── accessors ────────────────────────────────────────────────────────────

export const Tenants = {
  async get(id: string): Promise<Tenant | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("tenants").select("*").eq("id", id).single();
    return data ? mapTenant(data) : undefined;
  },
};

export const Users = {
  async get(id: string): Promise<User | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("users").select("*").eq("id", id).single();
    return data ? mapUser(data) : undefined;
  },
  async byTenant(tenantId: string): Promise<User[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("users").select("*").eq("tenant_id", tenantId);
    return (data ?? []).map(mapUser);
  },
  async updateRole(id: string, role: User["role"]) {
    const supabase = await createClient();
    await supabase.from("users").update({ role }).eq("id", id);
  },
};

export const Acts = {
  async all(): Promise<Act[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("acts").select("*").order("short_name");
    return (data ?? []).map(mapAct);
  },
  async get(id: string): Promise<Act | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("acts").select("*").eq("id", id).single();
    return data ? mapAct(data) : undefined;
  },
  async byDomain(domain: LegalDomain): Promise<Act[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("acts").select("*").contains("domains", [domain]);
    return (data ?? []).map(mapAct);
  },
};

export const Provisions = {
  async all(): Promise<Provision[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("provisions").select("*");
    return (data ?? []).map(mapProvision);
  },
  async get(id: string): Promise<Provision | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("provisions").select("*").eq("id", id).single();
    return data ? mapProvision(data) : undefined;
  },
  async byAct(actId: string): Promise<Provision[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("provisions").select("*").eq("act_id", actId);
    return (data ?? []).map(mapProvision);
  },
};

export const CaseLaws = {
  async all(): Promise<CaseLaw[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("case_law").select("*");
    return (data ?? []).map(mapCaseLaw);
  },
  async get(id: string): Promise<CaseLaw | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("case_law").select("*").eq("id", id).single();
    return data ? mapCaseLaw(data) : undefined;
  },
};

export const LegalRelationships = {
  async fromNode(id: string): Promise<LegalRelationship[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("legal_relationships").select("*").eq("from_id", id);
    return (data ?? []).map((r: any) => ({ id: r.id, fromId: r.from_id, toId: r.to_id, relation: r.relation, note: r.note ?? undefined }));
  },
};

export const DocumentTypes = {
  async all(): Promise<DocumentType[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("document_types").select("*").order("name");
    return (data ?? []).map(mapDocType);
  },
  async get(id: string): Promise<DocumentType | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("document_types").select("*").eq("id", id).single();
    return data ? mapDocType(data) : undefined;
  },
};

export const Matters = {
  async all(): Promise<Matter[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("matters").select("*").order("updated_at", { ascending: false });
    return (data ?? []).map(mapMatter);
  },
  async get(id: string): Promise<Matter | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("matters").select("*").eq("id", id).single();
    return data ? mapMatter(data) : undefined;
  },
  async byTenant(tenantId: string): Promise<Matter[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("matters").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
    return (data ?? []).map(mapMatter);
  },
  async create(m: Partial<Pick<Matter, "id">> & Omit<Matter, "id" | "createdAt" | "updatedAt">): Promise<Matter> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("matters").insert({
      tenant_id: m.tenantId, client_id: m.clientId, title: m.title, status: m.status,
      domains: m.domains, special_act_tags: m.specialActTags, jurisdiction: m.jurisdiction,
      sensitivity_level: m.sensitivityLevel, facts: m.facts, relief_sought: m.reliefSought,
      case_number: m.caseNumber, cnr: m.cnr, assigned_advocate_id: m.assignedAdvocateId,
      assigned_paralegal_id: m.assignedParalegalId,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create matter");
    return mapMatter(data);
  },
  async update(id: string, patch: Partial<Matter>): Promise<void> {
    const supabase = await createClient();
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) dbPatch.status = patch.status;
    if (patch.title) dbPatch.title = patch.title;
    if (patch.domains) dbPatch.domains = patch.domains;
    await supabase.from("matters").update(dbPatch).eq("id", id);
  },
};

export const MatterParties = {
  async byMatter(matterId: string): Promise<MatterParty[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("matter_parties").select("*").eq("matter_id", matterId);
    return (data ?? []).map(mapMatterParty);
  },
  async create(p: Omit<MatterParty, "id">): Promise<void> {
    const supabase = await createClient();
    await supabase.from("matter_parties").insert({
      matter_id: p.matterId, role: p.role, full_name: p.fullName, person_type: p.personType, address: p.address, contact: p.contact,
    });
  },
};

export const Drafts = {
  async all(): Promise<Draft[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("drafts").select("*").order("created_at", { ascending: false });
    return (data ?? []).map(mapDraft);
  },
  async get(id: string): Promise<Draft | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("drafts").select("*").eq("id", id).single();
    return data ? mapDraft(data) : undefined;
  },
  async byMatter(matterId: string): Promise<Draft[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("drafts").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
    return (data ?? []).map(mapDraft);
  },
  async create(d: Partial<Pick<Draft, "id">> & Omit<Draft, "id" | "createdAt" | "updatedAt">): Promise<Draft> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("drafts").insert({
      matter_id: d.matterId, document_type_id: d.documentTypeId, title: d.title, content: d.content,
      variables: d.variables, status: d.status, generated_by: d.generatedBy, coverage_score: d.coverageScore,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create draft");
    return mapDraft(data);
  },
  async update(id: string, patch: Partial<Draft>): Promise<void> {
    const supabase = await createClient();
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.status) dbPatch.status = patch.status;
    await supabase.from("drafts").update(dbPatch).eq("id", id);
  },
  async pendingReview(): Promise<Draft[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("drafts").select("*").in("status", ["in_review", "ai_generated"]);
    return (data ?? []).map(mapDraft);
  },
};

export const DraftCitations = {
  async byDraft(draftId: string): Promise<DraftCitation[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("draft_citations").select("*").eq("draft_id", draftId);
    return (data ?? []).map(mapDraftCitation);
  },
  async bulkCreate(cs: Omit<DraftCitation, "id">[]): Promise<void> {
    if (!cs.length) return;
    const supabase = await createClient();
    await supabase.from("draft_citations").insert(cs.map((c) => ({
      draft_id: c.draftId, provision_id: c.provisionId, case_law_id: c.caseLawId,
      cited_text: c.citedText, verification_status: c.verificationStatus, flag_reason: c.flagReason,
    })));
  },
};

export const ReviewActions = {
  async byDraft(draftId: string): Promise<ReviewAction[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("review_actions").select("*").eq("draft_id", draftId).order("created_at");
    return (data ?? []).map(mapReviewAction);
  },
  async create(r: Omit<ReviewAction, "id" | "createdAt">): Promise<void> {
    const supabase = await createClient();
    await supabase.from("review_actions").insert({ draft_id: r.draftId, reviewer_id: r.reviewerId, action: r.action, notes: r.notes });
  },
};

export const ChronologyEvents = {
  async byMatter(matterId: string): Promise<ChronologyEvent[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("chronology_events").select("*").eq("matter_id", matterId).order("event_date");
    return (data ?? []).map(mapChronology);
  },
  async create(e: Omit<ChronologyEvent, "id">): Promise<void> {
    const supabase = await createClient();
    await supabase.from("chronology_events").insert({
      matter_id: e.matterId, event_date: e.eventDate, description: e.description, person: e.person,
      related_document_id: e.relatedDocumentId, related_provision_id: e.relatedProvisionId,
      evidence_ref: e.evidenceRef, court_action: e.courtAction, next_action: e.nextAction, source: e.source,
    });
  },
};

export const Deadlines = {
  async all(): Promise<Deadline[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("deadlines").select("*").order("due_date");
    return (data ?? []).map(mapDeadline);
  },
  async byMatter(matterId: string): Promise<Deadline[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("deadlines").select("*").eq("matter_id", matterId).order("due_date");
    return (data ?? []).map(mapDeadline);
  },
  async create(d: Omit<Deadline, "id">): Promise<void> {
    const supabase = await createClient();
    await supabase.from("deadlines").insert({ matter_id: d.matterId, label: d.label, due_date: d.dueDate, basis: d.basis, source: d.source, status: d.status });
  },
};

export const ChatMessages = {
  async byMatter(matterId: string): Promise<ChatMessage[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("chat_messages").select("*").eq("matter_id", matterId).order("created_at");
    return (data ?? []).map((r: any) => ({ id: r.id, matterId: r.matter_id, role: r.role, content: r.content ?? "", citedProvisionIds: r.cited_provision_ids ?? undefined, createdAt: r.created_at }));
  },
  async create(m: Omit<ChatMessage, "id" | "createdAt">): Promise<void> {
    const supabase = await createClient();
    await supabase.from("chat_messages").insert({ matter_id: m.matterId, role: m.role, content: m.content, cited_provision_ids: m.citedProvisionIds });
  },
};

export async function logAudit(entry: Omit<AuditLogEntry, "id" | "createdAt">) {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    tenant_id: entry.tenantId, actor_id: entry.actorId, action: entry.action,
    entity_type: entry.entityType, entity_id: entry.entityId, metadata: entry.metadata as any,
  });
}

export const AuditLogs = {
  async all(): Promise<AuditLogEntry[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
    return (data ?? []).map((r: any) => ({ id: r.id, tenantId: r.tenant_id, actorId: r.actor_id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, metadata: r.metadata ?? undefined, createdAt: r.created_at }));
  },
};

export interface StateOnboardingRow { state: string; packStatus: "live" | "planned"; actsSeeded: number; notes: string; }
export const StateOnboarding = {
  async all(): Promise<StateOnboardingRow[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("state_onboarding").select("*").order("state");
    return (data ?? []).map((r: any) => ({ state: r.state, packStatus: r.pack_status, actsSeeded: r.acts_seeded ?? 0, notes: r.notes ?? "" }));
  },
};
