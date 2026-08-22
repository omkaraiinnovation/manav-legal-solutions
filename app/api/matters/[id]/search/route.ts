import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { Documents, DocumentChunks } from "@/lib/db/documents-repo";
import { embedText, embeddingsAvailable } from "@/lib/agents/embeddings";

export const maxDuration = 30;

export interface SmartSearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  sectionHeading?: string;
  snippet: string;
  matchType: "semantic" | "keyword" | "both";
  similarity?: number;
}

const SIMILARITY_FLOOR = 0.45; // slightly looser than Q&A's floor — search should surface plausible matches, not just near-exact ones

/**
 * Smart Search (spec §18): natural-language search over one matter's
 * documents. Hybrid by design — semantic search (pgvector) finds
 * conceptually related passages even when wording differs; keyword search
 * (substring match) catches exact tokens embeddings recall poorly on
 * (section numbers, case numbers, precise figures like "Section 420" or a
 * specific date). Results from both are merged and deduplicated by chunk.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await getCurrentUser();
  const { id: matterId } = await params;
  const body = await req.json();
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const documents = await Documents.byMatter(matterId);
  const nameById = new Map(documents.map((d) => [d.id, d.fileName]));

  const [semanticMatches, keywordMatches] = await Promise.all([
    embeddingsAvailable()
      ? embedText(query).then((emb) => DocumentChunks.semanticSearch(matterId, emb, 10)).catch(() => [])
      : Promise.resolve([]),
    DocumentChunks.keywordSearch(matterId, query, 10),
  ]);

  const merged = new Map<string, SmartSearchResult>();

  for (const m of semanticMatches) {
    if (m.similarity < SIMILARITY_FLOOR) continue;
    merged.set(m.id, {
      chunkId: m.id, documentId: m.document_id, documentName: nameById.get(m.document_id) ?? "Unknown document",
      page: m.page_number ?? undefined, sectionHeading: m.section_heading ?? undefined, snippet: m.content.slice(0, 500),
      matchType: "semantic", similarity: m.similarity,
    });
  }
  for (const k of keywordMatches) {
    const existing = merged.get(k.id);
    if (existing) {
      existing.matchType = "both";
    } else {
      merged.set(k.id, {
        chunkId: k.id, documentId: k.documentId, documentName: nameById.get(k.documentId) ?? "Unknown document",
        page: k.pageNumber, sectionHeading: k.sectionHeading, snippet: k.content.slice(0, 500), matchType: "keyword",
      });
    }
  }

  const results = Array.from(merged.values()).sort((a, b) => {
    // Matches found by both methods first, then by semantic similarity, keyword-only last.
    if (a.matchType === "both" && b.matchType !== "both") return -1;
    if (b.matchType === "both" && a.matchType !== "both") return 1;
    return (b.similarity ?? 0) - (a.similarity ?? 0);
  });

  return NextResponse.json({
    results,
    warning: !embeddingsAvailable() ? "Semantic search is unavailable (OPENAI_API_KEY not configured) — showing exact-text matches only." : undefined,
  });
}
