import { createClient } from "@/lib/supabase/server";
import type { JudgmentResult } from "@/lib/agents/judgment-research-agent";

export interface JudgmentResearchRecord {
  id: string;
  matterId?: string;
  draftId?: string;
  tenantId: string;
  query: string;
  jurisdictionState?: string;
  summary: string;
  judgments: JudgmentResult[];
  verifiedSourceUrls: string[];
  searchesUsed: number;
  modelUsed?: string;
  requestedBy?: string;
  /** The exact draft sentence/clause this research topic came from — set only for Judicial Enhancement Review runs. */
  draftExcerpt?: string;
  actSectionContext?: string;
  createdAt: string;
}

function mapRecord(r: any): JudgmentResearchRecord {
  return {
    id: r.id, matterId: r.matter_id ?? undefined, draftId: r.draft_id ?? undefined, tenantId: r.tenant_id,
    query: r.query, jurisdictionState: r.jurisdiction_state ?? undefined, summary: r.summary ?? "",
    judgments: r.judgments ?? [], verifiedSourceUrls: r.verified_source_urls ?? [], searchesUsed: r.searches_used ?? 0,
    modelUsed: r.model_used ?? undefined, requestedBy: r.requested_by ?? undefined,
    draftExcerpt: r.draft_excerpt ?? undefined, actSectionContext: r.act_section_context ?? undefined, createdAt: r.created_at,
  };
}

export const JudgmentResearch = {
  async byMatter(matterId: string): Promise<JudgmentResearchRecord[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("judgment_research").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
    return (data ?? []).map(mapRecord);
  },
  async byDraft(draftId: string): Promise<JudgmentResearchRecord[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("judgment_research").select("*").eq("draft_id", draftId).order("created_at", { ascending: false });
    return (data ?? []).map(mapRecord);
  },
  async create(r: {
    matterId?: string; draftId?: string; tenantId: string; query: string; jurisdictionState?: string;
    summary: string; judgments: JudgmentResult[]; verifiedSourceUrls: string[]; searchesUsed: number; modelUsed?: string; requestedBy?: string;
    draftExcerpt?: string; actSectionContext?: string;
  }): Promise<JudgmentResearchRecord> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("judgment_research").insert({
      matter_id: r.matterId, draft_id: r.draftId, tenant_id: r.tenantId, query: r.query, jurisdiction_state: r.jurisdictionState,
      summary: r.summary, judgments: r.judgments as any, verified_source_urls: r.verifiedSourceUrls as any,
      searches_used: r.searchesUsed, model_used: r.modelUsed, requested_by: r.requestedBy,
      draft_excerpt: r.draftExcerpt, act_section_context: r.actSectionContext,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? "Failed to store judgment research");
    return mapRecord(data);
  },
};
