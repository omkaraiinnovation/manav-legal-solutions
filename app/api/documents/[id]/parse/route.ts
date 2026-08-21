import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { Documents, DocumentChunks } from "@/lib/db/documents-repo";
import { logAudit } from "@/lib/db/repo";
import { MATTER_DOCUMENTS_BUCKET } from "@/lib/supabase/config";
import { parsePdf } from "@/lib/documents/parse-pdf";
import { parseDocx } from "@/lib/documents/parse-docx";
import { chunkDocument } from "@/lib/documents/chunk";
import { embedTexts, embeddingsAvailable } from "@/lib/agents/embeddings";

export const maxDuration = 60; // this route does real parsing/OCR work — give it the room Vercel allows

/**
 * Document Parsing & Processing Engine (spec Section 4-5): receive → validate →
 * extract text (OCR fallback for scanned PDFs) → detect structure → chunk →
 * embed → store — the full pipeline in one retriable step, run separately
 * from upload so a slow OCR pass never blocks the upload response.
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
    let text = "";
    let structure: Awaited<ReturnType<typeof parsePdf>>["structure"] = [];
    let pageCount: number | undefined;
    let ocrUsed = false;

    if (doc.fileType === "application/pdf") {
      let pdfResult;
      try {
        pdfResult = await parsePdf(buffer);
      } catch (err) {
        throw new DocumentParseError(
          `Could not read this PDF (${err instanceof Error ? err.message : "unknown error"}). It may be corrupt, password-protected, or use an unsupported PDF feature.`
        );
      }
      text = pdfResult.text;
      structure = pdfResult.structure;
      pageCount = pdfResult.pageCount;
      ocrUsed = pdfResult.ocrUsed;
      if (!text.trim()) {
        throw new DocumentParseError(
          pdfResult.ocrUsed
            ? "OCR ran but produced no readable text — the scan quality may be too low, or the pages may be blank."
            : "No text could be extracted from this PDF."
        );
      }
    } else if (
      doc.fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      doc.fileType === "application/msword"
    ) {
      if (doc.fileType === "application/msword") {
        throw new DocumentParseError("Legacy .doc files are not supported for automatic parsing — please save the document as .docx and re-upload.");
      }
      const docxResult = await parseDocx(buffer);
      text = docxResult.text;
      structure = docxResult.structure;
      if (!text.trim()) throw new DocumentParseError("No text could be extracted from this Word document — it may be empty or use unsupported content.");
    } else {
      throw new DocumentParseError(`Parsing is not implemented for file type "${doc.fileType}".`);
    }

    const chunks = chunkDocument(structure, text);
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
      status: "parsed", extractedText: text, structure, pageCount, ocrUsed, parsedAt: new Date().toISOString(),
    });

    await logAudit({
      tenantId: doc.tenantId, actorId: user.id, action: "document.parse", entityType: "document", entityId: id,
      metadata: { chunkCount: chunks.length, embedded, ocrUsed, pageCount },
    });

    return NextResponse.json({
      status: "parsed", pageCount, ocrUsed, chunkCount: chunks.length,
      embeddingsGenerated: embedded > 0,
      warning: embedded === 0 ? "Text was extracted and chunked, but OPENAI_API_KEY is not configured, so semantic Q&A search over this document is unavailable until it is." : undefined,
    });
  } catch (err) {
    const message = err instanceof DocumentParseError ? err.message : `Unexpected error while parsing: ${err instanceof Error ? err.message : "unknown error"}`;
    await Documents.update(id, { status: "failed", errorMessage: message });
    return NextResponse.json({ error: message }, { status: 422 });
  }
}

class DocumentParseError extends Error {}
