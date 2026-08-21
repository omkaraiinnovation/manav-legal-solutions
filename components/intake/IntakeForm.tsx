"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { INDIA_STATES_AND_UTS, LEGAL_DOMAINS, LEGAL_DOMAIN_LABELS } from "@/lib/types";
import type { IndiaStateOrUT, LegalDomain } from "@/lib/types";
import { Loader2, ArrowRight } from "lucide-react";

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
  const [files, setFiles] = useState<string[]>([]);
  const [form, setForm] = useState({
    personType: "individual", clientName: "", opposingPartyName: "",
    facts: "", state: "Bihar" as IndiaStateOrUT, district: "", court: "",
    incidentDate: "", domain: "" as LegalDomain | "", reliefSought: "", title: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/matters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      router.push(`/matters/${data.matter.id}`);
    } finally {
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
            <Field label="What happened?" help="Describe in your own words — this drives the applicable-law sweep and drafting.">
              <textarea className={inputClass} style={inputStyle} rows={6} value={form.facts} onChange={(e) => update("facts", e.target.value)} placeholder="Chronological narrative of facts…" />
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
            <Field label="Upload Evidence (optional)" help="Files are recorded on the matter file for the Document Intelligence pipeline to process after intake.">
              <input
                type="file" multiple className={inputClass} style={inputStyle}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []).map((f) => f.name))}
              />
            </Field>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {files.map((f) => <li key={f}>📎 {f}</li>)}
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
          <button
            onClick={submit}
            disabled={submitting || !form.facts.trim()}
            className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "var(--oxblood)" }}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
            Run Applicable-Law Sweep & Open Matter
          </button>
        )}
      </div>
    </div>
  );
}
