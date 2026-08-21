import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/session";
import { Documents, type DocumentRecord } from "@/lib/db/documents-repo";
import { logAudit } from "@/lib/db/repo";
import { MATTER_DOCUMENTS_BUCKET } from "@/lib/supabase/config";
import { resolveFormat, isZip, extensionOf, HUMAN_SUPPORTED_SUMMARY, type SourceKind } from "@/lib/documents/mime";
import { extractZip } from "@/lib/documents/extract-zip";

const MAX_SIZE_BYTES = 60 * 1024 * 1024; // 60MB — matches the storage bucket's limit; audio/video run larger than documents/images

/**
 * Universal ingestion entry point (spec §3/§8): one upload endpoint for every
 * supported format — documents, images, audio, video, and .zip batches —
 * rather than a separate mechanism per feature. A .zip is expanded into its
 * individual members here, each becoming its own document row; everything
 * else becomes exactly one. The response always carries a `documents` array
 * (length 1 for a normal upload) so callers don't need two code paths.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read the upload — the request body was not valid multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  const matterId = form.get("matterId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached to the upload." }, { status: 400 });
  }
  if (typeof matterId !== "string" || !matterId) {
    return NextResponse.json({ error: "matterId is required." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty (0 bytes)." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). The limit is 60MB.` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: matter } = await supabase.from("matters").select("*").eq("id", matterId).single();
  if (!matter) {
    return NextResponse.json({ error: "Matter not found, or you do not have access to it." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isZip(file.name, file.type)) {
    const { files, skipped } = extractZip(buffer);
    if (files.length === 0) {
      return NextResponse.json(
        { error: skipped.length ? `No supported files found in this archive. ${skipped.map((s) => `"${s.fileName}": ${s.reason}`).join(" ")}` : "This archive is empty." },
        { status: 400 }
      );
    }

    const documents: DocumentRecord[] = [];
    const failures: { fileName: string; reason: string }[] = [];
    for (const entry of files) {
      const format = resolveFormat(entry.fileName, entry.mimeType);
      if (!format) {
        failures.push({ fileName: entry.fileName, reason: "Unsupported file type after extraction." });
        continue;
      }
      try {
        const doc = await uploadAndCreateDocument(supabase, {
          buffer: entry.buffer, fileName: entry.fileName, mimeType: format.mimeType, sourceKind: format.sourceKind,
          tenantId: matter.tenant_id, matterId, uploadedBy: user.id, sourceArchiveName: file.name,
        });
        documents.push(doc);
      } catch (err) {
        failures.push({ fileName: entry.fileName, reason: err instanceof Error ? err.message : "Upload failed." });
      }
    }

    await logAudit({
      tenantId: matter.tenant_id, actorId: user.id, action: "document.upload_zip", entityType: "document", entityId: matterId,
      metadata: { archiveName: file.name, extracted: documents.length, skipped: skipped.length, failed: failures.length },
    });

    if (documents.length === 0) {
      return NextResponse.json({ error: `Could not process any file from this archive. ${failures.map((f) => `"${f.fileName}": ${f.reason}`).join(" ")}` }, { status: 422 });
    }

    return NextResponse.json({ documents, skipped: [...skipped, ...failures] });
  }

  const format = resolveFormat(file.name, file.type);
  if (!format) {
    return NextResponse.json(
      { error: `Unsupported file type "${file.type || extensionOf(file.name) || "unknown"}". Supported: ${HUMAN_SUPPORTED_SUMMARY}.` },
      { status: 400 }
    );
  }

  try {
    const doc = await uploadAndCreateDocument(supabase, {
      buffer, fileName: file.name, mimeType: format.mimeType, sourceKind: format.sourceKind,
      tenantId: matter.tenant_id, matterId, uploadedBy: user.id,
    });
    await logAudit({ tenantId: matter.tenant_id, actorId: user.id, action: "document.upload", entityType: "document", entityId: doc.id, metadata: { fileName: file.name, fileSizeBytes: file.size, sourceKind: format.sourceKind } });
    return NextResponse.json({ documents: [doc] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not record the upload." }, { status: 500 });
  }
}

async function uploadAndCreateDocument(
  supabase: SupabaseClient,
  opts: { buffer: Buffer; fileName: string; mimeType: string; sourceKind: SourceKind; tenantId: string; matterId: string; uploadedBy: string; sourceArchiveName?: string }
): Promise<DocumentRecord> {
  const safeName = opts.fileName.replace(/[^\w.\- ]/g, "_");
  const storagePath = `${opts.tenantId}/${opts.matterId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(MATTER_DOCUMENTS_BUCKET)
    .upload(storagePath, opts.buffer, { contentType: opts.mimeType, upsert: false });
  if (uploadError) throw new Error(`Storage upload failed for "${opts.fileName}": ${uploadError.message}`);

  try {
    return await Documents.create({
      matterId: opts.matterId, tenantId: opts.tenantId, fileName: opts.fileName, fileType: opts.mimeType,
      fileSizeBytes: opts.buffer.length, storagePath, uploadedBy: opts.uploadedBy, sourceKind: opts.sourceKind,
      sourceArchiveName: opts.sourceArchiveName,
    });
  } catch (err) {
    await supabase.storage.from(MATTER_DOCUMENTS_BUCKET).remove([storagePath]); // roll back the orphaned storage object
    throw new Error(`Could not record the upload of "${opts.fileName}": ${err instanceof Error ? err.message : "unknown error"}`);
  }
}
