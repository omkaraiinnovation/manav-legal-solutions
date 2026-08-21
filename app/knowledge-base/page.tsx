import { TopBar } from "@/components/shell/TopBar";
import { SectionHeader } from "@/components/ui/StatCard";
import { CoverageStatusBadge, TrustLevelBadge, Pill } from "@/components/ui/Badges";
import { getCurrentUser } from "@/lib/session";
import { Acts, Provisions, CaseLaws } from "@/lib/db/repo";
import { LEGAL_DOMAINS, LEGAL_DOMAIN_LABELS } from "@/lib/types";
import Link from "next/link";
import { BookOpenText, Scale3d } from "lucide-react";

export default async function KnowledgeBasePage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const user = await getCurrentUser();
  const { domain } = await searchParams;
  const acts = Acts.all();
  const provisions = Provisions.all();
  const caseLaw = CaseLaws.all();

  const filtered = domain ? acts.filter((a) => a.domains.includes(domain as any)) : acts;
  const sorted = [...filtered].sort((a, b) => {
    const order = { seeded: 0, stub: 1, planned: 2 };
    return order[a.coverageStatus] - order[b.coverageStatus] || a.shortName.localeCompare(b.shortName);
  });

  return (
    <div>
      <TopBar currentUser={user} title="Legal Knowledge Base" subtitle={`${acts.length} Acts · ${provisions.length} provisions · ${caseLaw.length} precedents`} />
      <div className="mx-auto max-w-5xl px-6 py-6">
        <SectionHeader eyebrow="Master Taxonomy" title="Browse by Domain" />
        <div className="mb-8 flex flex-wrap gap-1.5">
          <Link href="/knowledge-base"><Pill className={!domain ? "!border-[var(--oxblood)] !text-[var(--oxblood)]" : ""}>All Domains</Pill></Link>
          {LEGAL_DOMAINS.map((d) => (
            <Link key={d} href={`/knowledge-base?domain=${d}`}>
              <Pill className={domain === d ? "!border-[var(--oxblood)] !text-[var(--oxblood)]" : ""}>{LEGAL_DOMAIN_LABELS[d]}</Pill>
            </Link>
          ))}
        </div>

        <SectionHeader
          eyebrow="Special-Act Registry"
          title={domain ? LEGAL_DOMAIN_LABELS[domain as keyof typeof LEGAL_DOMAIN_LABELS] : "All Acts"}
        />
        <div className="paper-card divide-y" style={{ borderColor: "var(--hairline)" }}>
          {sorted.map((act) => {
            const provisionCount = provisions.filter((p) => p.actId === act.id).length;
            return (
              <Link key={act.id} href={`/knowledge-base/acts/${act.id}`} className="flex items-start justify-between gap-4 p-4 hover:bg-[var(--paper-sunken)]">
                <div className="flex items-start gap-3">
                  <BookOpenText size={16} className="mt-0.5 shrink-0 text-ink-faint" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{act.fullName}</span>
                      <TrustLevelBadge level={act.trustLevel} />
                    </div>
                    <p className="mt-0.5 max-w-xl text-xs text-ink-soft">{act.summary}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Pill>{act.jurisdictionLevel}{act.state ? ` · ${act.state}` : ""}</Pill>
                      <Pill>{act.status.replaceAll("_", " ")}</Pill>
                      {provisionCount > 0 && <Pill>{provisionCount} provisions</Pill>}
                    </div>
                  </div>
                </div>
                <CoverageStatusBadge status={act.coverageStatus} />
              </Link>
            );
          })}
          {sorted.length === 0 && <div className="p-6 text-center text-sm text-ink-faint">No Acts in this domain yet.</div>}
        </div>

        <div className="mt-6 flex items-center gap-2 rounded-[10px] border p-4 text-xs text-ink-faint" style={{ borderColor: "var(--hairline)" }}>
          <Scale3d size={14} className="shrink-0" />
          "Seeded & Verified" = full provision text ingested and spot-checked. "Act Known · Provisions Pending" = the Act's
          existence and metadata are confirmed but section-level text has not yet been ingested — do not rely on it for a
          filing without further research. Nothing in this base is ever presented as complete or infallible.
        </div>
      </div>
    </div>
  );
}
