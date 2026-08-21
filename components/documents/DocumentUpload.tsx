"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, ScanText, Mic, Square, Image as ImageIcon, Music, Video, Archive } from "lucide-react";
import type { DocumentRecord } from "@/lib/db/documents-repo";
import { ACCEPT_ATTRIBUTE, HUMAN_SUPPORTED_SUMMARY } from "@/lib/documents/mime";
import { useVoiceRecorder, formatSeconds } from "@/lib/hooks/useVoiceRecorder";

type UiStatus = "idle" | "uploading" | "parsing" | "done" | "error";

const KIND_ICON: Record<DocumentRecord["sourceKind"], typeof FileText> = {
  document: FileText, image: ImageIcon, audio: Music, video: Video,
};

/**
 * Universal ingestion widget (spec §3 "Provide Matter" experience): one
 * dropzone accepts every supported format including .zip batches, plus a
 * voice-first record button (spec §6) that captures a spoken narrative and
 * feeds it through the same upload → transcribe → chunk → embed pipeline as
 * an uploaded audio file. Reused verbatim across every module that accepts
 * supporting material — matter workspace, consultation intake — per §2's
 * "platform-wide capability, not an isolated feature."
 */
export function DocumentUpload({ matterId, existing }: { matterId: string; existing: DocumentRecord[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UiStatus>("idle");
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);

  const recorder = useVoiceRecorder((file) => { uploadOne(file).then(() => router.refresh()); });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      await uploadOne(file);
    }
    router.refresh();
  }

  async function uploadOne(file: File) {
    setError(null);
    setNotices([]);
    setStatus("uploading");
    setStatusText(`Uploading ${file.name}…`);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("matterId", matterId);
      const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed.");

      const documents: DocumentRecord[] = uploadData.documents ?? [];
      const skipped: { fileName: string; reason: string }[] = uploadData.skipped ?? [];
      if (skipped.length) setNotices(skipped.map((s) => `Skipped "${s.fileName}": ${s.reason}`));

      let parsedCount = 0;
      let anyLowConfidence = false;
      for (const doc of documents) {
        setStatus("parsing");
        setStatusText(
          documents.length > 1
            ? `Processing ${parsedCount + 1} of ${documents.length}: ${doc.fileName}…`
            : `${describeProcessing(doc.sourceKind)} ${doc.fileName}…`
        );
        const parseRes = await fetch(`/api/documents/${doc.id}/parse`, { method: "POST" });
        const parseData = await parseRes.json();
        if (!parseRes.ok) {
          setNotices((prev) => [...prev, `"${doc.fileName}" failed: ${parseData.error || "parsing error"}`]);
          continue;
        }
        if (parseData.lowConfidence) anyLowConfidence = true;
        parsedCount++;
      }

      setStatus("done");
      setStatusText(
        documents.length > 1
          ? `Processed ${parsedCount} of ${documents.length} files from the archive.${anyLowConfidence ? " Some extractions need verification — see below." : ""}`
          : anyLowConfidence
            ? "Done — extracted, but flagged for verification (see below)."
            : `Done — ${documents[0]?.fileName ?? file.name} processed.`
      );
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unexpected error during upload.");
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className="flex-1 cursor-pointer rounded-[10px] border-2 border-dashed p-6 text-center transition-colors hover:bg-[var(--paper-sunken)]"
          style={{ borderColor: "var(--hairline)" }}
        >
          <Upload size={22} className="mx-auto mb-2" style={{ color: "var(--brass)" }} />
          <p className="text-sm font-medium">Click or drag files here — or a .zip of many</p>
          <p className="mt-1 text-xs text-ink-faint">{HUMAN_SUPPORTED_SUMMARY} — up to 60MB each.</p>
          <input ref={inputRef} type="file" multiple className="hidden" accept={ACCEPT_ATTRIBUTE} onChange={(e) => handleFiles(e.target.files)} />
        </div>

        <button
          type="button"
          onClick={recorder.status === "recording" ? recorder.stop : recorder.start}
          disabled={status === "uploading" || status === "parsing"}
          className="flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed px-5 py-6 text-center transition-colors hover:bg-[var(--paper-sunken)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-44"
          style={{ borderColor: recorder.status === "recording" ? "var(--flagged)" : "var(--hairline)" }}
        >
          {recorder.status === "recording" ? (
            <>
              <Square size={20} style={{ color: "var(--flagged)" }} className="animate-pulse" />
              <span className="text-sm font-medium">Stop · {formatSeconds(recorder.seconds)}</span>
            </>
          ) : (
            <>
              <Mic size={20} style={{ color: "var(--brass)" }} />
              <span className="text-sm font-medium">Speak the matter</span>
            </>
          )}
        </button>
      </div>

      {recorder.status === "recording" && (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--hairline)" }}>
          <Mic size={14} className="mt-0.5 shrink-0 animate-pulse" style={{ color: "var(--flagged)" }} />
          <span>Recording your voice note… speak naturally, click Stop when finished.</span>
        </div>
      )}

      {recorder.status !== "recording" && status !== "idle" && (
        <div className="mt-3 flex items-start gap-2 rounded-[8px] border px-3 py-2.5 text-xs" style={{ borderColor: "var(--hairline)" }}>
          {status === "uploading" || status === "parsing" ? (
            <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin" />
          ) : status === "done" ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "var(--verified)" }} />
          ) : (
            <XCircle size={14} className="mt-0.5 shrink-0" style={{ color: "var(--flagged)" }} />
          )}
          <span>{error || recorder.error || statusText}</span>
        </div>
      )}

      {notices.length > 0 && (
        <div className="mt-2 space-y-1">
          {notices.map((n, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--unverified)" }}>
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      {existing.length > 0 && (
        <div className="mt-4 space-y-2">
          {existing.map((d) => {
            const Icon = KIND_ICON[d.sourceKind] ?? FileText;
            return (
              <div key={d.id} className="paper-card flex items-start gap-3 p-3.5">
                <Icon size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{d.fileName}</span>
                    {d.sourceArchiveName && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-ink-faint" style={{ background: "var(--paper-sunken)" }}>
                        <Archive size={10} /> from {d.sourceArchiveName}
                      </span>
                    )}
                    {d.ocrUsed && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--info)", background: "var(--info-tint)" }}>
                        <ScanText size={10} /> OCR
                      </span>
                    )}
                    {d.lowConfidence && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--unverified)", background: "var(--unverified-tint, transparent)" }}>
                        <AlertTriangle size={10} /> Verify accuracy
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-faint">
                    {d.status === "parsed" && (
                      <>
                        <CheckCircle2 size={11} style={{ color: "var(--verified)" }} /> Parsed
                        {d.pageCount ? ` · ${d.pageCount} page${d.pageCount === 1 ? "" : "s"}` : ""}
                        {d.durationSeconds ? ` · ${formatSeconds(Math.round(d.durationSeconds))}` : ""}
                      </>
                    )}
                    {d.status === "parsing" && <><Loader2 size={11} className="animate-spin" /> Processing…</>}
                    {d.status === "uploaded" && <><AlertTriangle size={11} style={{ color: "var(--unverified)" }} /> Uploaded, not yet parsed</>}
                    {d.status === "failed" && <span style={{ color: "var(--flagged)" }}><XCircle size={11} className="mr-1 inline" />{d.errorMessage || "Parsing failed"}</span>}
                  </div>
                  {d.extractionNotes && <p className="mt-1 text-xs italic text-ink-faint">{d.extractionNotes}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function describeProcessing(kind: DocumentRecord["sourceKind"]): string {
  switch (kind) {
    case "image": return "Running OCR on";
    case "audio": return "Transcribing";
    case "video": return "Transcribing";
    default: return "Extracting text from";
  }
}
