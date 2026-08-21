import { cn } from "@/lib/utils";
import type { TrustLevel } from "@/lib/types";
import { TRUST_LEVEL_LABELS } from "@/lib/types";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Lock } from "lucide-react";

export function VerificationBadge({ status }: { status: "verified" | "unverified" | "flagged" }) {
  const map = {
    verified: { color: "var(--verified)", tint: "var(--verified-tint)", label: "Verified", Icon: ShieldCheck },
    unverified: { color: "var(--unverified)", tint: "var(--unverified-tint)", label: "Unverified", Icon: ShieldQuestion },
    flagged: { color: "var(--flagged)", tint: "var(--flagged-tint)", label: "Flagged", Icon: ShieldAlert },
  }[status];
  const { color, tint, label, Icon } = map;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color, background: tint }}
    >
      <Icon size={13} strokeWidth={2.25} />
      {label}
    </span>
  );
}

export function TrustLevelBadge({ level }: { level: TrustLevel }) {
  return (
    <span
      title={TRUST_LEVEL_LABELS[level]}
      className="seal-ring inline-flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold"
      style={{ color: "var(--brass)" }}
    >
      {level}
    </span>
  );
}

export function SensitivityBadge({ level }: { level: "standard" | "restricted" }) {
  if (level === "standard") return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: "var(--restricted)", background: "var(--restricted-tint)" }}
    >
      <Lock size={12} strokeWidth={2.5} />
      Restricted Access
    </span>
  );
}

export function CoverageStatusBadge({ status }: { status: "seeded" | "stub" | "planned" }) {
  const map = {
    seeded: { label: "Seeded & Verified", color: "var(--verified)", tint: "var(--verified-tint)" },
    stub: { label: "Act Known · Provisions Pending", color: "var(--unverified)", tint: "var(--unverified-tint)" },
    planned: { label: "Planned", color: "var(--ink-faint)", tint: "var(--paper-sunken)" },
  }[status];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium" style={{ color: map.color, background: map.tint }}>
      {map.label}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", className)}
      style={{ borderColor: "var(--hairline)", color: "var(--ink-soft)" }}>
      {children}
    </span>
  );
}
