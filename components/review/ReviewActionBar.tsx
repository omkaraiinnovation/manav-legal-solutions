"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X, RotateCcw, Loader2 } from "lucide-react";

export function ReviewActionBar({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function act(action: string) {
    setLoading(action);
    try {
      await fetch(`/api/drafts/${draftId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, notes }) });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const buttons = [
    { action: "approve", label: "Approve", Icon: Check, style: { background: "var(--verified)" } },
    { action: "edit", label: "Send to Edit", Icon: Pencil, style: { background: "var(--info)" } },
    { action: "request_revision", label: "Ask AI to Revise", Icon: RotateCcw, style: { background: "var(--brass)" } },
    { action: "reject", label: "Reject", Icon: X, style: { background: "var(--flagged)" } },
  ];

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Review notes (optional)…"
        rows={2}
        className="w-full rounded-[8px] border bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--oxblood)]"
        style={{ borderColor: "var(--hairline)" }}
      />
      <div className="grid grid-cols-2 gap-2">
        {buttons.map((b) => (
          <button
            key={b.action}
            onClick={() => act(b.action)}
            disabled={!!loading}
            className="flex items-center justify-center gap-1.5 rounded-[8px] py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={b.style}
          >
            {loading === b.action ? <Loader2 size={13} className="animate-spin" /> : <b.Icon size={13} />}
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
