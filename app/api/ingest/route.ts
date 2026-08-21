import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { resolveFormat, isZip, extensionOf, HUMAN_SUPPORTED_SUMMARY } from "@/lib/documents/mime";
import { extractZip } from "@/lib/documents/extract-zip";
import { ingestFile, DocumentParseError } from "@/lib/documents/ingest";

export const maxDuration = 60;

const MAX_SIZE_BYTES = 60 * 1024 * 1024;

export interface IngestedAttachment {
  fileName: string;
  sourceKind: "document" | "image" | "audio" | "video";
  text: string;
  lowConfidence: boolean;
  extractionNotes?: string;
  pageCount?: number;
  durationSeconds?: number;
}

/**
 * Ephemeral ingestion: runs a file through the same OCR/vision-LLM/Whisper
 * pipeline as a matter document (spec §2 — "platform-wide capability, not an
 * isolated feature"), but extracts and returns text without writing to
 * Storage or the documents table. Used by modules that need to fold uploaded
 * material into an AI request (e.g. consultation chat, where no Matter may
 * exist yet) without prematurely creating case-workspace records for a
 * conversation that hasn't become a matter.
 */
export async function POST(req: NextRequest) {
  await getCurrentUser(); // auth-gated, but nothing persisted per-tenant here

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload — the request body was not valid multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "The uploaded file is empty (0 bytes)." }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). The limit is 60MB.` }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isZip(file.name, file.type)) {
    const { files, skipped } = extractZip(buffer);
    const attachments: IngestedAttachment[] = [];
    const failures: { fileName: string; reason: string }[] = [];
    for (const entry of files) {
      const format = resolveFormat(entry.fileName, entry.mimeType);
      if (!format) { failures.push({ fileName: entry.fileName, reason: "Unsupported file type." }); continue; }
      try {
        const result = await ingestFile(entry.buffer, entry.fileName, format.mimeType, format.sourceKind);
        attachments.push({ fileName: entry.fileName, sourceKind: format.sourceKind, text: result.text, lowConfidence: result.lowConfidence, extractionNotes: result.extractionNotes, pageCount: result.pageCount, durationSeconds: result.durationSeconds });
      } catch (err) {
        failures.push({ fileName: entry.fileName, reason: err instanceof Error ? err.message : "Processing failed." });
      }
    }
    if (attachments.length === 0) {
      return NextResponse.json({ error: `Could not process any file from this archive. ${[...skipped, ...failures].map((s) => `"${s.fileName}": ${s.reason}`).join(" ")}` }, { status: 422 });
    }
    return NextResponse.json({ attachments, skipped: [...skipped, ...failures] });
  }

  const format = resolveFormat(file.name, file.type);
  if (!format) {
    return NextResponse.json({ error: `Unsupported file type "${file.type || extensionOf(file.name) || "unknown"}". Supported: ${HUMAN_SUPPORTED_SUMMARY}.` }, { status: 400 });
  }

  try {
    const result = await ingestFile(buffer, file.name, format.mimeType, format.sourceKind);
    return NextResponse.json({
      attachments: [{ fileName: file.name, sourceKind: format.sourceKind, text: result.text, lowConfidence: result.lowConfidence, extractionNotes: result.extractionNotes, pageCount: result.pageCount, durationSeconds: result.durationSeconds }],
    });
  } catch (err) {
    const message = err instanceof DocumentParseError ? err.message : `Could not process this file: ${err instanceof Error ? err.message : "unknown error"}`;
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
