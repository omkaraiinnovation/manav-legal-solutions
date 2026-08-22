import { createClient } from "@/lib/supabase/server";

export interface EvidenceFactSource {
  type: "client_narrative" | "document";
  documentId?: string;
  documentName?: string;
  page?: number;
  snippet: string;
}

export interface EvidenceFact {
  id: string;
  claim: string;
  factType: "date" | "amount" | "name" | "location" | "event" | "allegation" | "other";
  sources: EvidenceFactSource[];
}

export interface EvidenceContradiction {
  description: string;
  factIds: string[];
  severity: "high" | "medium" | "low";
}

export interface EvidenceMissingSupport {
  allegation: string;
  note: string;
}

export interface EvidenceDuplicate {
  description: string;
  documentIds: string[];
}

export interface EvidenceAnalysisRecord {
  id: string;
  matterId: string;
  tenantId: string;
  facts: EvidenceFact[];
  contradictions: EvidenceContradiction[];
  missingSupport: EvidenceMissingSupport[];
  duplicates: EvidenceDuplicate[];
  modelUsed?: string;
  generatedBy?: string;
  createdAt: string;
}

function mapRecord(r: any): EvidenceAnalysisRecord {
  return {
    id: r.id, matterId: r.matter_id, tenantId: r.tenant_id,
    facts: r.facts ?? [], contradictions: r.contradictions ?? [], missingSupport: r.missing_support ?? [], duplicates: r.duplicates ?? [],
    modelUsed: r.model_used ?? undefined, generatedBy: r.generated_by ?? undefined, createdAt: r.created_at,
  };
}

export const EvidenceAnalyses = {
  async latestForMatter(matterId: string): Promise<EvidenceAnalysisRecord | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("evidence_analyses").select("*").eq("matter_id", matterId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? mapRecord(data) : undefined;
  },
  async create(a: {
    matterId: string; tenantId: string; facts: EvidenceFact[]; contradictions: EvidenceContradiction[];
    missingSupport: EvidenceMissingSupport[]; duplicates: EvidenceDuplicate[]; modelUsed?: string; generatedBy?: string;
  }): Promise<EvidenceAnalysisRecord> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("evidence_analyses").insert({
      matter_id: a.matterId, tenant_id: a.tenantId, facts: a.facts as any, contradictions: a.contradictions as any,
      missing_support: a.missingSupport as any, duplicates: a.duplicates as any, model_used: a.modelUsed, generated_by: a.generatedBy,
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? "Failed to store evidence analysis");
    return mapRecord(data);
  },
};
