import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { Documents, DocumentChunks } from "@/lib/db/documents-repo";
import { logAudit } from "@/lib/db/repo";
import { MATTER_DOCUMENTS_BUCKET } from "@/lib/supabase/config";
import { chunkDocument } from "@/lib/documents/chunk";
import { embedTexts, embeddingsAvailable } from "@/lib/agents/embeddings";
import { ingestFile, DocumentParseError } from "@/lib/documents/ingest";

export const maxDuration = 60; // this route does real parsing/OCR/transcription work — give it the room Vercel allows

/**
 * Document Parsing & Processing Engine (spec §4-8): receive → dispatch by
 * source kind (document/image/audio/video) → extract text (OCR/vision-LLM/
 * speech-to-text as appropriate) → detect structure → chunk → embed → store
 * — the full pipeline in one retriable step, run separately from upload so a
 * slow OCR/transcription pass never blocks the upload response.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const doc = await Documents.get(id);
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  await Documents.update(id, { status: "parsing" });

  try {
    const supabase = await createClient();
    const { data: fileBlob, error: downloadError } = await supabase.storage.from(MATTER_DOCUMENTS_BUCKET).download(doc.storagePath);
    if (downloadError || !fileBlob) throw new Error(`Could not retrieve the stored file: ${downloadError?.message ?? "unknown error"}`);

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const result = await ingestFile(buffer, doc.fileName, doc.fileType, doc.sourceKind);

    const chunks = chunkDocument(result.structure, result.text);
    if (chunks.length === 0) throw new DocumentParseError("Text was extracted but could not be split into any usable chunks.");

    let embedded = 0;
    if (embeddingsAvailable()) {
      const embeddings = await embedTexts(chunks.map((c) => c.content));
      await DocumentChunks.bulkCreate(
        chunks.map((c, i) => ({
          documentId: doc.id, matterId: doc.matterId, tenantId: doc.tenantId, chunkIndex: i,
          content: c.content, embedding: embeddings[i] ?? null, pageNumber: c.page, sectionHeading: c.sectionHeading,
        }))
      );
      embedded = embeddings.length;
    } else {
      // Store chunks without embeddings so the text is still browsable/searchable-by-keyword;
      // semantic Q&A will report embeddings as unavailable until OPENAI_API_KEY is configured.
      await DocumentChunks.bulkCreate(
        chunks.map((c, i) => ({
          documentId: doc.id, matterId: doc.matterId, tenantId: doc.tenantId, chunkIndex: i,
          content: c.content, embedding: null, pageNumber: c.page, sectionHeading: c.sectionHeading,
        }))
      );
    }

    await Documents.update(id, {
      status: "parsed", extractedText: result.text, structure: result.structure, pageCount: result.pageCount,
      ocrUsed: result.ocrUsed, durationSeconds: result.durationSeconds, lowConfidence: result.lowConfidence,
      extractionNotes: result.extractionNotes, parsedAt: new Date().toISOString(),
    });

    await logAudit({
      tenantId: doc.tenantId, actorId: user.id, action: "document.parse", entityType: "document", entityId: id,
      metadata: { chunkCount: chunks.length, embedded, ocrUsed: result.ocrUsed, pageCount: result.pageCount, sourceKind: doc.sourceKind, lowConfidence: result.lowConfidence },
    });

    return NextResponse.json({
      status: "parsed", pageCount: result.pageCount, durationSeconds: result.durationSeconds, ocrUsed: result.ocrUsed,
      lowConfidence: result.lowConfidence, extractionNotes: result.extractionNotes, chunkCount: chunks.length,
      embeddingsGenerated: embedded > 0,
      warning: embedded === 0 ? "Text was extracted and chunked, but OPENAI_API_KEY is not configured, so semantic Q&A search over this document is unavailable until it is." : undefined,
    });
  } catch (err) {
    const message = err instanceof DocumentParseError ? err.message : `Unexpected error while parsing: ${err instanceof Error ? err.message : "unknown error"}`;
    await Documents.update(id, { status: "failed", errorMessage: message });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
