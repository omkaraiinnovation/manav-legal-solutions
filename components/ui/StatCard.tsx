import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, sub, Icon, accent,
}: { label: string; value: string | number; sub?: string; Icon: LucideIcon; accent?: "oxblood" | "brass" | "verified" | "flagged" }) {
  const color = accent ? `var(--${accent})` : "var(--ink)";
  return (
    <div className="paper-card lift-on-hover relative flex items-start justify-between overflow-hidden p-5">
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundImage: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
      )}
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</div>
        <div className="font-display mt-1 text-3xl font-semibold tabular-nums" style={{ color }}>{value}</div>
        {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
      </div>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ring-1"
        style={{
          backgroundImage: accent ? `linear-gradient(155deg, color-mix(in srgb, ${color} 18%, transparent), color-mix(in srgb, ${color} 6%, transparent))` : undefined,
          background: accent ? undefined : "var(--paper-sunken)",
          color,
          boxShadow: accent ? `inset 0 1px 0 color-mix(in srgb, ${color} 20%, transparent)` : undefined,
          "--tw-ring-color": accent ? `color-mix(in srgb, ${color} 22%, transparent)` : "var(--hairline)",
        } as React.CSSProperties}
      >
        <Icon size={18} strokeWidth={2} />
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brass)" }}>{eyebrow}</div>}
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}
