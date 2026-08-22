"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { INDIA_STATES_AND_UTS, LEGAL_DOMAINS, LEGAL_DOMAIN_LABELS } from "@/lib/types";
import type { IndiaStateOrUT, LegalDomain } from "@/lib/types";
import { Loader2, ArrowRight, Mic, Square, X, Paperclip } from "lucide-react";
import { ACCEPT_ATTRIBUTE, HUMAN_SUPPORTED_SUMMARY } from "@/lib/documents/mime";
import { useVoiceRecorder, formatSeconds } from "@/lib/hooks/useVoiceRecorder";

const PERSON_TYPES = ["individual", "company", "government", "minor", "woman", "senior_citizen", "organisation", "foreign_entity"] as const;

function Field({ label, children, help }: { label: string; children: React.ReactNode; help?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-ink-faint">{help}</span>}
    </label>
  );
}

const inputClass = "w-full rounded-[8px] border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--oxblood)]";
const inputStyle = { borderColor: "var(--hairline)" };

export function IntakeForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const factFileInputRef = useRef<HTMLInputElement>(null);
  const [extractingFacts, setExtractingFacts] = useState(false);
  const [extractFactsError, setExtractFactsError] = useState<string | null>(null);
  const [form, setForm] = useState({
    personType: "individual", clientName: "", opposingPartyName: "",
    facts: "", state: "Bihar" as IndiaStateOrUT, district: "", court: "",
    incidentDate: "", domain: "" as LegalDomain | "", reliefSought: "", title: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const recorder = useVoiceRecorder(async (file) => {
    setTranscribeError(null);
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ingest", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed.");
      const transcript = data.attachments?.[0]?.text ?? "";
      if (transcript) {
        update("facts", form.facts ? `${form.facts}\n\n${transcript}` : transcript);
      }
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Could not transcribe the recording.");
    } finally {
      setTranscribing(false);
    }
  });

  /** Reads PDF/Word/image/etc. files dropped onto the facts step directly into the narrative —
   *  the same "don't make the user retype what the system can read" principle as the mic button,
   *  just for documents instead of speech. The files are also kept for real upload once the
   *  matter exists (same `files` state step 6 already uploads), so a source like an FIR PDF
   *  becomes both part of the narrative now and a real, OCR'd, searchable matter document later. */
  async function handleFactFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList);
    setFiles((prev) => [...prev, ...picked]);
    setExtractFactsError(null);
    setExtractingFacts(true);
    try {
      for (const file of picked) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/ingest", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `Could not read "${file.name}".`);
          for (const attachment of data.attachments ?? []) {
            if (!attachment.text) continue;
            const block = `--- ${attachment.fileName ?? file.name} ---\n${attachment.text}`;
            setForm((f) => ({ ...f, facts: f.facts ? `${f.facts}\n\n${block}` : block }));
          }
        } catch (err) {
          setExtractFactsError((prev) => {
            const msg = err instanceof Error ? err.message : `Could not read "${file.name}".`;
            return prev ? `${prev} ${msg}` : msg;
          });
        }
      }
    } finally {
      setExtractingFacts(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitStatus("");
    try {
      const res = await fetch("/api/matters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the matter.");
      const matterId = data.matter.id as string;

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setSubmitStatus(`Uploading evidence ${i + 1} of ${files.length}: ${file.name}…`);
          try {
            const uploadForm = new FormData();
            uploadForm.append("file", file);
            uploadForm.append("matterId", matterId);
            const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: uploadForm });
            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) continue; // don't block matter creation on one bad file — the workspace will show what's missing
            for (const doc of uploadData.documents ?? []) {
              setSubmitStatus(`Processing ${doc.fileName}…`);
              await fetch(`/api/documents/${doc.id}/parse`, { method: "POST" });
            }
          } catch {
            // Same — a failed upload here isn't fatal to matter creation; it's visible on the workspace.
          }
        }
      }

      router.push(`/matters/${matterId}`);
    } catch (err) {
      setSubmitStatus(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  const steps = ["Who", "What Happened", "Where", "When", "Domain", "Evidence"];

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-6 flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                background: i + 1 <= step ? "var(--oxblood)" : "var(--paper-sunken)",
                color: i + 1 <= step ? "white" : "var(--ink-faint)",
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && <div className="h-px flex-1" style={{ background: i + 1 < step ? "var(--oxblood)" : "var(--hairline)" }} />}
          </div>
        ))}
      </div>
      <div className="mb-4 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--brass)" }}>
        Step {step} of {steps.length} — {steps[step - 1]}
      </div>

      <div className="paper-card animate-rise space-y-4 p-6">
        {step === 1 && (
          <>
            <Field label="Who is the client?">
              <select value={form.personType} onChange={(e) => update("personType", e.target.value)} className={inputClass} style={inputStyle}>
                {PERSON_TYPES.map((p) => <option key={p} value={p}>{p.replaceAll("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Client Name"><input className={inputClass} style={inputStyle} value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Full name" /></Field>
            <Field label="Opposite Party (if any)"><input className={inputClass} style={inputStyle} value={form.opposingPartyName} onChange={(e) => update("opposingPartyName", e.target.value)} placeholder="Name of opposing party" /></Field>
          </>
        )}
        {step === 2 && (
          <>
            <Field label="Matter Title (optional)"><input className={inputClass} style={inputStyle} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. Yadav v. Prasad — Eviction" /></Field>
            <Field label="What happened?" help={`Describe in your own words, speak it, or attach a document (${HUMAN_SUPPORTED_SUMMARY}) and its contents will be read into the narrative automatically.`}>
              <div className="relative">
                <textarea className={inputClass} style={{ ...inputStyle, paddingRight: "5rem" }} rows={6} value={form.facts} onChange={(e) => update("facts", e.target.value)} placeholder="Chronological narrative of facts, or click the mic to speak it, or attach a document…" />
                <input ref={factFileInputRef} type="file" multiple className="hidden" accept={ACCEPT_ATTRIBUTE} onChange={(e) => { handleFactFiles(e.target.files); e.target.value = ""; }} />
                <button
                  type="button"
                  onClick={() => factFileInputRef.current?.click()}
                  title="Attach a document — its contents will be read into the narrative"
                  className="absolute right-11 top-2 flex h-8 w-8 items-center justify-center rounded-[8px] border"
                  style={inputStyle}
                >
                  <Paperclip size={14} />
                </button>
                <button
                  type="button"
                  onClick={recorder.status === "recording" ? recorder.stop : recorder.start}
                  title="Speak the matter"
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-[8px] border"
                  style={{ borderColor: recorder.status === "recording" ? "var(--flagged)" : "var(--hairline)", color: recorder.status === "recording" ? "var(--flagged)" : undefined }}
                >
                  {recorder.status === "recording" ? <Square size={14} /> : <Mic size={14} />}
                </button>
              </div>
              {recorder.status === "recording" && (
                <span className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: "var(--flagged)" }}>
                  <Mic size={11} className="animate-pulse" /> Recording… {formatSeconds(recorder.seconds)} — click Stop when finished.
                </span>
              )}
              {transcribing && <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint"><Loader2 size={11} className="animate-spin" /> Transcribing…</span>}
              {extractingFacts && <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint"><Loader2 size={11} className="animate-spin" /> Reading document…</span>}
              {extractFactsError && <span className="mt-1 block text-xs" style={{ color: "var(--flagged)" }}>{extractFactsError}</span>}
              {(transcribeError || recorder.error) && <span className="mt-1 block text-xs" style={{ color: "var(--flagged)" }}>{transcribeError || recorder.error}</span>}
            </Field>
            <Field label="Relief Sought"><textarea className={inputClass} style={inputStyle} rows={2} value={form.reliefSought} onChange={(e) => update("reliefSought", e.target.value)} placeholder="What outcome does the client want?" /></Field>
          </>
        )}
        {step === 3 && (
          <>
            <Field label="State / UT">
              <select value={form.state} onChange={(e) => update("state", e.target.value as IndiaStateOrUT)} className={inputClass} style={inputStyle}>
                {INDIA_STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="District"><input className={inputClass} style={inputStyle} value={form.district} onChange={(e) => update("district", e.target.value)} placeholder="e.g. Patna" /></Field>
            <Field label="Court (if known)"><input className={inputClass} style={inputStyle} value={form.court} onChange={(e) => update("court", e.target.value)} placeholder="e.g. Court of the Munsif, Patna Sadar" /></Field>
          </>
        )}
        {step === 4 && (
          <Field label="Date / Time Period of Incident">
            <input type="date" className={inputClass} style={inputStyle} value={form.incidentDate} onChange={(e) => update("incidentDate", e.target.value)} />
          </Field>
        )}
        {step === 5 && (
          <Field label="What is involved? (optional — the sweep will also auto-detect)">
            <select value={form.domain} onChange={(e) => update("domain", e.target.value as LegalDomain)} className={inputClass} style={inputStyle}>
              <option value="">Let the system detect automatically</option>
              {LEGAL_DOMAINS.map((d) => <option key={d} value={d}>{LEGAL_DOMAIN_LABELS[d]}</option>)}
            </select>
          </Field>
        )}
        {step === 6 && (
          <div>
            <Field label="Upload Evidence (optional)" help={`Uploaded once the matter is created below — ${HUMAN_SUPPORTED_SUMMARY}.`}>
              <input
                type="file" multiple className={inputClass} style={inputStyle} accept={ACCEPT_ATTRIBUTE}
                onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
            </Field>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">📎 {f.name} <span className="text-xs text-ink-faint">({(f.size / 1024).toFixed(0)}KB)</span></span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-ink-faint hover:text-current">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-[8px] border px-4 py-2 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: "var(--hairline)" }}
        >
          Back
        </button>
        {step < steps.length ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={step === 2 && !form.facts.trim()}
            className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "var(--oxblood)" }}
          >
            Next <ArrowRight size={14} />
          </button>
        ) : (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={submit}
              disabled={submitting || !form.facts.trim()}
              className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              style={{ background: "var(--oxblood)" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              Run Applicable-Law Sweep & Open Matter
            </button>
            {submitStatus && <span className="text-xs text-ink-faint">{submitStatus}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
