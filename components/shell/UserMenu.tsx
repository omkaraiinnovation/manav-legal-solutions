"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/lib/types";
import { ChevronDown, LogOut } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  firm_admin: "Firm Admin",
  advocate: "Advocate",
  paralegal: "Paralegal",
  client: "Client",
};

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-left text-sm hover:bg-[var(--paper-sunken)]"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--oxblood)" }}>
          {user.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="font-medium">{user.fullName}</div>
          <div className="text-xs text-ink-faint">{ROLE_LABELS[user.role]}</div>
        </div>
        <ChevronDown size={14} className="text-ink-faint" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-[10px] border py-1 animate-rise"
          style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)", boxShadow: "var(--shadow-raised)" }}
        >
          <div className="px-3 py-2 text-xs text-ink-faint">{user.email}</div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--paper-sunken)] disabled:opacity-50"
            style={{ color: "var(--flagged)" }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
