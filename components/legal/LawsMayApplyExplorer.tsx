"use client";
import { useState } from "react";
import { INDIA_STATES_AND_UTS } from "@/lib/types";
import type { IndiaStateOrUT, ApplicableLawRow } from "@/lib/types";
import { ApplicableLawTable } from "./ApplicableLawTable";
import { Loader2, Scale } from "lucide-react";

export function LawsMayApplyExplorer() {
  const [facts, setFacts] = useState("");
  const [state, setState] = useState<IndiaStateOrUT>("Bihar");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ rows: ApplicableLawRow[]; conflictFlag?: string; statePackNote: string } | null>(null);

  async function run() {
    if (!facts.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/laws-apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facts, state }) });
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="paper-card p-6">
        <div className="mb-3 flex items-center gap-2" style={{ color: "var(--brass)" }}>
          <Scale size={18} />
          <span className="text-sm font-medium">Signature Feature</span>
        </div>
        <textarea
          value={facts}
          onChange={(e) => setFacts(e.target.value)}
          rows={4}
          placeholder="Describe the facts — e.g. 'A minor was assaulted by a person known to the family in Patna.'"
          className="w-full rounded-[8px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]"
          style={{ borderColor: "var(--hairline)" }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <select
            value={state}
            onChange={(e) => setState(e.target.value as IndiaStateOrUT)}
            className="rounded-[8px] border bg-transparent px-3 py-2 text-sm"
            style={{ borderColor: "var(--hairline)" }}
          >
            {INDIA_STATES_AND_UTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={run}
            disabled={loading || !facts.trim()}
            className="flex items-center gap-2 rounded-[8px] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "var(--oxblood)" }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            What Laws May Apply?
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 animate-rise">
          <ApplicableLawTable rows={result.rows} conflictFlag={result.conflictFlag} statePackNote={result.statePackNote} />
        </div>
      )}
    </div>
  );
}
