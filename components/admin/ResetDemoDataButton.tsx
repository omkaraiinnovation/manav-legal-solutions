"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";

export function ResetDemoDataButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        if (!confirm("Reset all local demo data back to the seeded state? This discards any matters/drafts created in this session.")) return;
        setLoading(true);
        await fetch("/api/admin/reset", { method: "POST" });
        setLoading(false);
        router.refresh();
      }}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
      style={{ borderColor: "var(--hairline)" }}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
      Reset Demo Data
    </button>
  );
}
