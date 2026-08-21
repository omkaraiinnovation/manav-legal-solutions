import { VerificationBadge } from "@/components/ui/Badges";
import type { ApplicableLawRow } from "@/lib/types";

const CONFIDENCE_COLOR: Record<string, string> = { high: "var(--verified)", medium: "var(--unverified)", low: "var(--ink-faint)" };

export function ApplicableLawTable({ rows, conflictFlag, statePackNote }: { rows: ApplicableLawRow[]; conflictFlag?: string; statePackNote?: string }) {
  const grouped = rows.reduce<Record<string, ApplicableLawRow[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {conflictFlag && (
        <div className="rounded-[10px] border px-4 py-3 text-sm" style={{ borderColor: "var(--flagged)", background: "var(--flagged-tint)", color: "var(--flagged)" }}>
          ⚠ <strong>Article 254 Conflict Check:</strong> {conflictFlag}
        </div>
      )}
      {statePackNote && (
        <div className="rounded-[10px] border px-4 py-3 text-sm" style={{ borderColor: "var(--hairline)", background: "var(--paper-sunken)", color: "var(--ink-soft)" }}>
          {statePackNote}
        </div>
      )}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{category}</div>
          <div className="paper-card overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {items.map((row, i) => (
                  <tr key={i} className="border-t first:border-t-0" style={{ borderColor: "var(--hairline)" }}>
                    <td className="w-1/3 px-4 py-3 align-top font-medium">{row.law}</td>
                    <td className="px-4 py-3 align-top text-ink-soft">{row.reason}</td>
                    <td className="w-24 px-4 py-3 align-top">
                      <span className="text-xs font-semibold" style={{ color: CONFIDENCE_COLOR[row.confidence] }}>
                        {row.confidence}
                      </span>
                    </td>
                    <td className="w-28 px-4 py-3 align-top">
                      <VerificationBadge status={row.verified ? "verified" : "unverified"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <div className="paper-card p-6 text-center text-sm text-ink-faint">
          No candidate laws detected yet — add more specific facts (what happened, who was involved, where).
        </div>
      )}
    </div>
  );
}
