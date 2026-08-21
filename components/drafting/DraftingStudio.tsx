"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Matter, DocumentType } from "@/lib/types";
import { Loader2, Gavel, ChevronDown } from "lucide-react";

const inputClass = "w-full rounded-[8px] border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--oxblood)]";
const inputStyle = { borderColor: "var(--hairline)" };

export function DraftingStudio({ matters, documentTypes, initialMatterId }: { matters: Matter[]; documentTypes: DocumentType[]; initialMatterId?: string }) {
  const router = useRouter();
  const [matterId, setMatterId] = useState(initialMatterId ?? matters[0]?.id ?? "");
  const [docTypeId, setDocTypeId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const docType = useMemo(() => documentTypes.find((d) => d.id === docTypeId), [docTypeId, documentTypes]);
  const matter = useMemo(() => matters.find((m) => m.id === matterId), [matterId, matters]);

  const relevantDocTypes = useMemo(
    () => (matter ? documentTypes.filter((d) => d.domains.some((dom) => matter.domains.includes(dom))) : documentTypes),
    [matter, documentTypes]
  );

  async function generate() {
    if (!matterId || !docTypeId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matterId, documentTypeId: docTypeId, variables }) });
      const data = await res.json();
      router.push(`/review/${data.draft.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="paper-card animate-rise space-y-5 p-6">
        <div className="flex items-center gap-2" style={{ color: "var(--brass)" }}>
          <Gavel size={18} />
          <span className="text-sm font-medium">Mode B — Drafting</span>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Matter</span>
          <select value={matterId} onChange={(e) => setMatterId(e.target.value)} className={inputClass} style={inputStyle}>
            {matters.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Document Type ({relevantDocTypes.length} suggested for this matter's domain)</span>
          <select value={docTypeId} onChange={(e) => { setDocTypeId(e.target.value); setVariables({}); }} className={inputClass} style={inputStyle}>
            <option value="">Select a document type…</option>
            {relevantDocTypes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            <optgroup label="All document types">
              {documentTypes.filter((d) => !relevantDocTypes.includes(d)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </optgroup>
          </select>
          {docType && <span className="mt-1 block text-xs text-ink-faint">{docType.description}</span>}
        </label>

        {docType && (
          <div className="space-y-3 rounded-[10px] border p-4" style={{ borderColor: "var(--hairline)" }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Variables</div>
            {docType.variableSchema.map((v) => (
              <label key={v.key} className="block">
                <span className="mb-1 block text-sm">{v.label}{v.required && <span style={{ color: "var(--flagged)" }}> *</span>}</span>
                {v.type === "textarea" ? (
                  <textarea rows={2} className={inputClass} style={inputStyle} value={variables[v.key] ?? ""} onChange={(e) => setVariables((x) => ({ ...x, [v.key]: e.target.value }))} />
                ) : (
                  <input
                    type={v.type === "date" ? "date" : v.type === "number" || v.type === "currency" ? "number" : "text"}
                    className={inputClass} style={inputStyle}
                    value={variables[v.key] ?? ""}
                    onChange={(e) => setVariables((x) => ({ ...x, [v.key]: e.target.value }))}
                  />
                )}
                {v.help && <span className="mt-0.5 block text-xs text-ink-faint">{v.help}</span>}
              </label>
            ))}
            <div className="text-xs text-ink-faint">
              Mandatory sections: {docType.templateSkeletonSections.join(" → ")}
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading || !matterId || !docTypeId}
          className="flex w-full items-center justify-center gap-2 rounded-[8px] py-2.5 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "var(--oxblood)" }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Gavel size={15} />}
          Generate Draft
        </button>
        <p className="text-center text-xs text-ink-faint">
          Every draft is run through the Citation Verification Agent before it appears in the Lawyer Review Console.
        </p>
      </div>
    </div>
  );
}
