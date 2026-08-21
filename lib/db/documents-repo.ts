/**
 * Document Intelligence & RAG data access — documents, their chunks, and Q&A
 * history. Kept separate from repo.ts because these tables carry pgvector
 * embeddings and semantic-search RPCs, a distinct concern from the core
 * case-management schema.
 */
import { createClient } from "@/lib/supabase/server";

export interface DocumentRecord {
  id: string;
  matterId: string;
  tenantId: string;
  fileName: string;
  fileType: string;
  fileSizeBytes?: number;
  storagePath: string;
  status: "uploaded" | "parsing" | "parsed" | "failed";
  ocrUsed: boolean;
  pageCount?: number;
  extractedText?: string;
  structure: DocumentStructureNode[];
  errorMessage?: string;
  uploadedBy?: string;
  createdAt: string;
  parsedAt?: string;
}

export interface DocumentStructureNode {
  type: "heading" | "paragraph" | "table" | "list_item";
  level?: number;
  text: string;
  page?: number;
}

export interface DocumentChunkRecord {
  id: string;
  documentId: string;
  matterId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  sectionHeading?: string;
  metadata: Record<string, unknown>;
}

export interface QaHistoryRecord {
  id: string;
  matterId: string;
  question: string;
  answer: string;
  sources: QaSource[];
  confidence: "grounded" | "partial" | "insufficient";
  modelUsed: string;
  createdAt: string;
}

export interface QaSource {
  type: "document_chunk" | "provision" | "case_law";
  id: string;
  label: string;
  snippet: string;
  page?: number;
}

function mapDocument(r: any): DocumentRecord {
  return {
    id: r.id, matterId: r.matter_id, tenantId: r.tenant_id, fileName: r.file_name, fileType: r.file_type,
    fileSizeBytes: r.file_size_bytes ?? undefined, storagePath: r.storage_path, status: r.status,
    ocrUsed: !!r.ocr_used, pageCount: r.page_count ?? undefined, extractedText: r.extracted_text ?? undefined,
    structure: r.structure ?? [], errorMessage: r.error_message ?? undefined, uploadedBy: r.uploaded_by ?? undefined,
    createdAt: r.created_at, parsedAt: r.parsed_at ?? undefined,
  };
}

export const Documents = {
  async byMatter(matterId: string): Promise<DocumentRecord[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("documents").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
    return (data ?? []).map(mapDocument);
  },
  async get(id: string): Promise<DocumentRecord | undefined> {
    const supabase = await createClient();
    const { data } = await supabase.from("documents").select("*").eq("id", id).single();
    return data ? mapDocument(data) : undefined;
  },
  async create(d: { matterId: string; tenantId: string; fileName: string; fileType: string; fileSizeBytes: number; storagePath: string; uploadedBy: string }): Promise<DocumentRecord> {
    const supabase = await createClient();
    const { data, error } = await supabase.from("documents").insert({
      matter_id: d.matterId, tenant_id: d.tenantId, file_name: d.fileName, file_type: d.fileType,
      file_size_bytes: d.fileSizeBytes, storage_path: d.storagePath, uploaded_by: d.uploadedBy, status: "uploaded",
    }).select().single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create document record");
    return mapDocument(data);
  },
  async update(id: string, patch: Partial<{
    status: DocumentRecord["status"]; ocrUsed: boolean; pageCount: number; extractedText: string;
    structure: DocumentStructureNode[]; errorMessage: string; parsedAt: string;
  }>): Promise<void> {
    const supabase = await createClient();
    const dbPatch: Record<string, unknown> = {};
    if (patch.status) dbPatch.status = patch.status;
    if (patch.ocrUsed !== undefined) dbPatch.ocr_used = patch.ocrUsed;
    if (patch.pageCount !== undefined) dbPatch.page_count = patch.pageCount;
    if (patch.extractedText !== undefined) dbPatch.extracted_text = patch.extractedText;
    if (patch.structure) dbPatch.structure = patch.structure;
    if (patch.errorMessage !== undefined) dbPatch.error_message = patch.errorMessage;
    if (patch.parsedAt) dbPatch.parsed_at = patch.parsedAt;
    await supabase.from("documents").update(dbPatch).eq("id", id);
  },
};

export const DocumentChunks = {
  async bulkCreate(chunks: { documentId: string; matterId: string; tenantId: string; chunkIndex: number; content: string; embedding: number[] | null; pageNumber?: number; sectionHeading?: string; metadata?: Record<string, unknown> }[]): Promise<void> {
    if (!chunks.length) return;
    const supabase = await createClient();
    await supabase.from("document_chunks").insert(chunks.map((c) => ({
      document_id: c.documentId, matter_id: c.matterId, tenant_id: c.tenantId, chunk_index: c.chunkIndex,
      content: c.content, embedding: c.embedding as any, page_number: c.pageNumber, section_heading: c.sectionHeading,
      metadata: c.metadata ?? {},
    })));
  },
  async byDocument(documentId: string): Promise<DocumentChunkRecord[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("document_chunks").select("*").eq("document_id", documentId).order("chunk_index");
    return (data ?? []).map((r: any) => ({
      id: r.id, documentId: r.document_id, matterId: r.matter_id, tenantId: r.tenant_id, chunkIndex: r.chunk_index,
      content: r.content, pageNumber: r.page_number ?? undefined, sectionHeading: r.section_heading ?? undefined, metadata: r.metadata ?? {},
    }));
  },
  /** Semantic search within one matter's uploaded documents via the match_document_chunks RPC (pgvector cosine). */
  async semanticSearch(matterId: string, queryEmbedding: number[], matchCount = 8) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmbedding as any, match_matter_id: matterId, match_count: matchCount,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; document_id: string; chunk_index: number; content: string; page_number: number | null; section_heading: string | null; metadata: any; similarity: number }[];
  },
};

export const KnowledgeBaseSearch = {
  /** Semantic search over the seeded provisions (BNS/BNSS/BSA etc.) via the match_provisions RPC. */
  async semanticSearchProvisions(queryEmbedding: number[], matchCount = 6) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_provisions", { query_embedding: queryEmbedding as any, match_count: matchCount });
    if (error) throw new Error(error.message);
    return (data ?? []) as { id: string; act_id: string; section_number: string; title: string; text_content: string; similarity: number }[];
  },
};

export const QaHistory = {
  async byMatter(matterId: string): Promise<QaHistoryRecord[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("qa_history").select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
    return (data ?? []).map((r: any) => ({ id: r.id, matterId: r.matter_id, question: r.question, answer: r.answer, sources: r.sources ?? [], confidence: r.confidence, modelUsed: r.model_used ?? "", createdAt: r.created_at }));
  },
  async create(q: { matterId: string; tenantId: string; question: string; answer: string; sources: QaSource[]; confidence: QaHistoryRecord["confidence"]; modelUsed: string; askedBy?: string }): Promise<void> {
    const supabase = await createClient();
    await supabase.from("qa_history").insert({
      matter_id: q.matterId, tenant_id: q.tenantId, question: q.question, answer: q.answer,
      sources: q.sources as any, confidence: q.confidence, model_used: q.modelUsed, asked_by: q.askedBy,
    });
  },
};
