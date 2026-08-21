"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { User } from "@/lib/types";
import { ChevronDown } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  firm_admin: "Firm Admin",
  advocate: "Advocate",
  paralegal: "Paralegal",
  client: "Client",
};

export function RoleSwitcher({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = users.find((u) => u.id === currentUserId)!;

  async function switchTo(userId: string) {
    await fetch("/api/session", { method: "POST", body: JSON.stringify({ userId }) });
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-left text-sm hover:bg-[var(--paper-sunken)]"
        style={{ borderColor: "var(--hairline)" }}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "var(--oxblood)" }}
        >
          {current.fullName.slice(0, 1)}
        </div>
        <div className="hidden sm:block leading-tight">
          <div className="font-medium">{current.fullName}</div>
          <div className="text-xs text-ink-faint">{ROLE_LABELS[current.role]}</div>
        </div>
        <ChevronDown size={14} className="text-ink-faint" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-[10px] border py-1 animate-rise"
          style={{ borderColor: "var(--hairline)", background: "var(--paper-raised)", boxShadow: "var(--shadow-raised)" }}
        >
          <div className="px-3 py-1.5 text-xs font-medium text-ink-faint">Demo — switch persona</div>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => switchTo(u.id)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--paper-sunken)]"
            >
              <span>
                {u.fullName}
                <span className="ml-2 text-xs text-ink-faint">{ROLE_LABELS[u.role]}</span>
              </span>
              {u.id === currentUserId && <span style={{ color: "var(--brass)" }}>●</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
