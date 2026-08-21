import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/session";
import { Documents } from "@/lib/db/documents-repo";
import { logAudit } from "@/lib/db/repo";
import { MATTER_DOCUMENTS_BUCKET } from "@/lib/supabase/config";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB — keep under Supabase Storage's default limit with headroom

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
    return NextResponse.json({ error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). The limit is 25MB.` }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type "${file.type || "unknown"}". Supported: PDF, DOC, DOCX, PNG, JPG.` }, { status: 400 });
  }

  const supabase = await createClient();

  // Confirm the caller can actually see this matter (RLS backs this up server-side regardless).
  const { data: matter } = await supabase.from("matters").select("*").eq("id", matterId).single();
  if (!matter) {
    return NextResponse.json({ error: "Matter not found, or you do not have access to it." }, { status: 404 });
  }

  const safeName = file.name.replace(/[^\w.\- ]/g, "_");
  const storagePath = `${matter.tenant_id}/${matterId}/${Date.now()}_${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(MATTER_DOCUMENTS_BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 502 });
  }

  try {
    const doc = await Documents.create({
      matterId, tenantId: matter.tenant_id, fileName: file.name, fileType: file.type,
      fileSizeBytes: file.size, storagePath, uploadedBy: user.id,
    });

    await logAudit({ tenantId: matter.tenant_id, actorId: user.id, action: "document.upload", entityType: "document", entityId: doc.id, metadata: { fileName: file.name, fileSizeBytes: file.size } });

    return NextResponse.json({ document: doc });
  } catch (err) {
    // Roll back the orphaned storage object if the DB insert failed.
    await supabase.storage.from(MATTER_DOCUMENTS_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: `Could not record the upload: ${err instanceof Error ? err.message : "unknown error"}` }, { status: 500 });
  }
}
