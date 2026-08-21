"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const ROLES = ["client", "paralegal", "advocate", "firm_admin", "platform_admin"] as const;
const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin", firm_admin: "Firm Admin", advocate: "Advocate", paralegal: "Paralegal", client: "Client",
};

export function RoleSelect({ userId, currentRole, disabled }: { userId: string; currentRole: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function change(role: string) {
    setLoading(true);
    try {
      await fetch(`/api/admin/users/${userId}/role`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {loading && <Loader2 size={13} className="animate-spin text-ink-faint" />}
      <select value={currentRole} disabled={disabled || loading} onChange={(e) => change(e.target.value)} className="text-xs">
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
    </div>
  );
}
