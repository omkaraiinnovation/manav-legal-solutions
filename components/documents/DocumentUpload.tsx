"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, ScanText } from "lucide-react";
import type { DocumentRecord } from "@/lib/db/documents-repo";

type UiStatus = "idle" | "uploading" | "parsing" | "done" | "error";

export function DocumentUpload({ matterId, existing }: { matterId: string; existing: DocumentRecord[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await uploadOne(file);
    }
    router.refresh();
  }

  async function uploadOne(file: File) {
    setError(null);
    setStatus("uploading");
    setStatusText(`Uploading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("matterId", matterId);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed.");

      setStatus("parsing");
      setStatusText(`Extracting text${file.type === "application/pdf" ? " (running OCR if this is a scanned PDF)" : ""}…`);
      const parseRes = await fetch(`/api/documents/${uploadData.document.id}/parse`, { method: "POST" });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || "Parsing failed.");

      setStatus("done");
      setStatusText(parseData.warning || `Done — ${parseData.chunkCount} chunks indexed${parseData.ocrUsed ? " (OCR used)" : ""}.`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected error during upload.");
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-[10px] border-2 border-dashed p-6 text-center transition-colors hover:bg-[var(--paper-sunken)]"
        style={{ borderColor: "var(--hairline)" }}
      >
        <Upload size={22} className="mx-auto mb-2" style={{ color: "var(--brass)" }} />
        <p className="text-sm font-medium">Click or drag a file here to upload</p>
        <p className="mt-1 text-xs text-ink-faint">PDF, DOCX, PNG, JPG — up to 25MB. Scanned PDFs are OCR'd automatically.</p>
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {status !== "idle" && (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--hairline)" }}>
          {status === "uploading" || status === "parsing" ? <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" /> : status === "done" ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--verified)" }} /> : <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--flagged)" }} />}
          <span>{error || statusText}</span>
        </div>
      )}

      {existing.length > 0 && (
        <div className="mt-4 space-y-2">
          {existing.map((d) => (
            <div key={d.id} className="paper-card flex items-start gap-3 p-3.5">
              <FileText size={16} className="mt-0.5 shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{d.fileName}</span>
                  {d.ocrUsed && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--info)", background: "var(--info-tint)" }}>
                      <ScanText size={10} /> OCR
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                  {d.status === "parsed" && <><CheckCircle2 size={11} style={{ color: "var(--verified)" }} /> Parsed{d.pageCount ? ` · ${d.pageCount} page${d.pageCount === 1 ? "" : "s"}` : ""}</>}
                  {d.status === "parsing" && <><Loader2 size={11} className="animate-spin" /> Processing…</>}
                  {d.status === "uploaded" && <><AlertTriangle size={11} style={{ color: "var(--unverified)" }} /> Uploaded, not yet parsed</>}
                  {d.status === "failed" && <span style={{ color: "var(--flagged)" }}><XCircle size={11} className="mr-1 inline" />{d.errorMessage || "Parsing failed"}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
